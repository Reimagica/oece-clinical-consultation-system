"use client";
import { useEffect, useRef, useState } from "react";
import PatientMedia, { PatientMediaTools } from "./patient-media";
import { speakPatientText, stopPatientPlayback, usePatientPlayback } from "./patient-playback";

type Turn = { id: string; speaker: "student" | "patient"; text: string; time: string; cancelled?: boolean };
type Recognition = { lang: string; onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
const KEY = "oece-patient-experience-v1";

type ContextMessage = { role: "user" | "assistant"; content: string };
export default function LivePatientChat({ storageKey = KEY, compact = false, context = [], allowSupplemental = true }: { storageKey?: string; compact?: boolean; context?: ContextMessage[]; allowSupplemental?: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const { speaking } = usePatientPlayback();
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || "{}") as { turns?: Turn[]; question?: string; ended?: boolean };
        if (Array.isArray(saved.turns)) setTurns(saved.turns.filter(turn => turn && typeof turn.text === "string"));
        if (typeof saved.question === "string") setQuestion(saved.question);
        setEnded(saved.ended === true);
      } catch { /* A damaged draft starts a fresh experience. */ }
      setLoaded(true);
    }, 0);
    return () => { window.clearTimeout(restore); controller.current?.abort(); recognition.current?.stop(); stopPatientPlayback(); };
  }, [storageKey]);
  useEffect(() => { if (loaded) { try { localStorage.setItem(storageKey, JSON.stringify({ turns, question, ended })); } catch { /* Keep this conversation usable when device storage is full. */ } } }, [loaded, storageKey, turns, question, ended]);
  useEffect(() => { if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; }, [turns.length, busy]);
  const pending = turns.at(-1)?.speaker === "student" && !turns.at(-1)?.cancelled ? turns.at(-1)! : null;
  const speak = (text: string) => speakPatientText(text);
  const startVoice = () => {
    const browser = window as typeof window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) { setError("当前浏览器不支持语音输入，可以输入文字提问。"); return; }
    stopPatientPlayback();
    const session = new Constructor();
    recognition.current = session;
    session.lang = "zh-CN";
    session.onresult = event => setQuestion(event.results[0][0].transcript);
    session.onerror = () => { setListening(false); setError("语音识别未完成，可以输入文字提问。"); };
    session.onend = () => setListening(false);
    setError(""); setListening(true); session.start();
  };
  const ask = async () => {
    if (controller.current || !loaded || (ended && !allowSupplemental)) return;
    recognition.current?.stop();
    const text = pending?.text ?? question.trim();
    if (!text) return;
    stopPatientPlayback();
    const id = pending?.id ?? crypto.randomUUID();
    const currentTurns = turns;
    if (!pending) { setTurns(current => [...current, { id, speaker: "student", text, time: new Date().toLocaleTimeString("zh-CN") }]); setQuestion(""); }
    const request = new AbortController();
    controller.current = request; setBusy(true); setError("");
    const timeout = window.setTimeout(() => request.abort(), 22000);
    try {
      const history = [...context, ...currentTurns.filter(turn => turn.id !== id && !turn.cancelled).map(turn => ({ role: turn.speaker === "student" ? "user" : "assistant", content: turn.text }))].slice(-16);
      const response = await fetch("/api/patient", { method: "POST", headers: { "Content-Type": "application/json" }, signal: request.signal, body: JSON.stringify({ question: text, history, mode: compact || ended ? "supplemental" : "live" }) });
      const data = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error ?? "患者暂时无法回复，请重试。");
      if (request.signal.aborted) return;
      setTurns(current => current.some(turn => turn.id === `${id}-reply`) ? current : [...current, { id: `${id}-reply`, speaker: "patient", text: data.answer!, time: new Date().toLocaleTimeString("zh-CN") }]);
      speak(data.answer);
    } catch (cause) {
      setError(request.signal.aborted ? "请求已停止或超时，提问已保留，可重试。" : cause instanceof Error ? cause.message : "连接失败，请重试。");
    } finally { window.clearTimeout(timeout); if (controller.current === request) controller.current = null; setBusy(false); }
  };
  const supplemental = compact || ended;
  const canAsk = !ended || allowSupplemental;
  return <div className={`history-layout live-experience ${compact ? "supplemental-chat" : ""}`} aria-label={compact ? "补充问诊" : "实时交互体验"}>
    <section className="patient-stage">
      {!compact && <>
      <div className={`patient-frame ${speaking ? "speaking" : ""}`}>
        <PatientMedia alt="标准化患者郭曼" />
        <div className="room-badge"><span><i />实时交互体验</span><small>急诊留观室 · 床旁评估</small></div>
        <div className="patient-overlay"><span>郭曼</span><small>语音问诊体验</small></div>
        {busy && <div className="patient-thinking" aria-live="polite"><i /><i /><i /><span>正在思考</span></div>}
      </div>
      <PatientMediaTools />
      <div className="recent-audio"><button type="button" disabled={!turns.some(turn => turn.speaker === "patient")} onClick={() => { const latest = [...turns].reverse().find(turn => turn.speaker === "patient"); if (latest) speak(latest.text); }}>▶</button><div><strong>患者最近回答</strong><span>{[...turns].reverse().find(turn => turn.speaker === "patient")?.text ?? "请先向患者提问"}</span></div></div>
      </>}
      <div className="experience-compose"><label htmlFor="experience-question">{supplemental ? "补充问诊" : "向患者提问"}</label>{supplemental && <p>问诊已结束，可继续向郭曼提问。</p>}{canAsk ? <><textarea id="experience-question" value={question} disabled={!loaded || busy || Boolean(pending)} onChange={event => setQuestion(event.target.value)} placeholder="语音提问或输入文字，Ctrl + Enter 发送" rows={3} maxLength={500} onKeyDown={event => { if (!event.nativeEvent.isComposing && event.ctrlKey && event.key === "Enter") { event.preventDefault(); void ask(); } }} /><div><button type="button" className="outline-button" onClick={() => listening ? recognition.current?.stop() : startVoice()} disabled={!loaded || busy || Boolean(pending)}>{listening ? "结束录音" : "语音提问"}</button><button type="button" className="primary-button" disabled={!loaded || busy || (!pending && !question.trim())} onClick={() => void ask()}>{pending ? "重试问题" : "发送问题"}</button>{!supplemental && <button type="button" className="outline-button" disabled={!loaded || busy || Boolean(pending) || listening} onClick={() => { stopPatientPlayback(); setEnded(true); }}>结束问诊</button>}</div></> : <p>本次问诊已结束。</p>}</div>
      {pending && !busy && <button type="button" className="outline-button" onClick={() => { setQuestion(pending.text); setTurns(current => current.map(turn => turn.id === pending.id ? { ...turn, cancelled: true } : turn)); }}>取消未答问题</button>}
      {busy && <button type="button" className="outline-button" onClick={() => controller.current?.abort()}>停止等待</button>}
      {error && <p className="patient-live-error" role="alert">{error}</p>}
    </section>
    <aside className="transcript-panel"><div className="transcript-head"><div><span className="live-dot" /><strong>{compact ? "补充问诊记录" : "对话记录"}</strong></div><small>{turns.length} 条</small></div><div className="transcript-list" ref={viewport}>{turns.length ? turns.map(turn => <div className={`turn ${turn.speaker}`} key={turn.id}><div><b>{turn.speaker === "student" ? "考生" : "郭曼"}</b><time>{turn.time}{turn.cancelled ? " · 已取消" : ""}</time></div><p>{turn.text}</p>{turn.speaker === "patient" && <button type="button" onClick={() => speak(turn.text)}>▷ 重听</button>}</div>) : <div className="transcript-empty"><strong>尚未开始{compact ? "补充问诊" : "问诊"}</strong><p>对话将在这里显示。</p></div>}</div></aside>
  </div>;
}
