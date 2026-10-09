"use client";
import { useEffect, useRef, useState } from "react";

type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const SPEECH_START = "aimed-dictation-start";

export default function SpeechInput({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const [interim, setInterim] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const latest = useRef({ value, onChange, disabled });
  useEffect(() => { latest.current = { value, onChange, disabled }; }, [value, onChange, disabled]);
  useEffect(() => {
    const browser = window as SpeechWindow;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(!!(browser.SpeechRecognition ?? browser.webkitSpeechRecognition));
    const stopOther = () => recognition.current?.stop();
    window.addEventListener(SPEECH_START, stopOther);
    return () => { window.removeEventListener(SPEECH_START, stopOther); if (recognition.current) { recognition.current.onresult = null; recognition.current.onerror = null; recognition.current.onend = null; recognition.current.abort(); recognition.current = null; } };
  }, []);
  useEffect(() => { if (disabled) recognition.current?.abort(); }, [disabled]);
  const toggle = () => {
    if (disabled) return;
    if (recognition.current) { recognition.current.stop(); return; }
    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) return;
    window.dispatchEvent(new Event(SPEECH_START));
    const instance = new Constructor();
    instance.lang = "zh-CN"; instance.continuous = true; instance.interimResults = true;
    instance.onresult = event => {
      if (latest.current.disabled) return;
      let final = "", draft = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else draft += event.results[i][0].transcript;
      }
      if (final) {
        const next = latest.current.value + final;
        latest.current.value = next;
        latest.current.onChange(next);
      }
      setInterim(draft);
    };
    instance.onerror = event => { setMessage(event.error === "not-allowed" || event.error === "service-not-allowed" ? "麦克风权限被拒绝，请在浏览器中允许后重试。" : event.error === "no-speech" ? "未听到语音，请重试。" : event.error === "aborted" ? "" : "语音识别暂不可用，请重试或使用文字输入。"); };
    instance.onend = () => { if (recognition.current === instance) recognition.current = null; setListening(false); setInterim(""); };
    recognition.current = instance;
    try { setMessage(""); instance.start(); setListening(true); } catch { recognition.current = null; setMessage("语音输入未能启动，请重试。"); }
  };
  return <div className="speech-input-control"><button type="button" className={`speech-input-button ${listening ? "listening" : ""}`} aria-label={`${label}${listening ? "停止语音输入" : "语音输入"}`} aria-pressed={listening} disabled={disabled || supported !== true} onClick={toggle}>
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>{listening ? "停止录音" : "语音输入"}</button>
    <small role="status">{message || interim || (listening ? "正在听取…识别文字会追加到输入框" : supported === false ? "此浏览器不支持语音识别，可使用 Chrome 或 Edge。" : "")}</small>
  </div>;
}
