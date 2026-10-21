"use client";
import { useEffect, useId, useRef, useState } from "react";
import PatientMedia, { PatientMediaTools } from "./patient-media";
import { speakPatientText, stopPatientPlayback, usePatientPlayback } from "./patient-playback";
import type { TranscriptTurn } from "./demo-data";

type Turn = { id: string; speaker: "student" | "patient"; text: string; time: string; cancelled?: boolean };
type Recognition = { lang: string; onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type ContextMessage = { role: "user" | "assistant"; content: string };
type ScriptedConversation = {
  turns: TranscriptTurn[];
  canAdvance: boolean;
  state: "idle" | "recording" | "thinking" | "speaking";
  next: () => void;
  cancel: () => void;
  replay: (text: string) => void;
};
const KEY = "oece-patient-experience-v1";

export default function LivePatientChat({ storageKey = KEY, context = [], scripted, startQuestion = false }: {
  storageKey?: string;
  context?: ContextMessage[];
  scripted?: ScriptedConversation;
  startQuestion?: boolean;
}) {
  // Persist only extra questions here. Shared display must not merge scripted
  // scoring evidence with the independently stored experience/follow-up turns.
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [composerOpen, setComposerOpen] = useState(!scripted || startQuestion);
  const { speaking } = usePatientPlayback();
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const questionField = useRef<HTMLTextAreaElement>(null);
  const questionId = useId();
  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || "{}") as { turns?: Turn[]; question?: string; ended?: boolean };
        if (Array.isArray(saved.turns)) setTurns(saved.turns.filter(turn => turn && typeof turn.text === "string"));
        if (typeof saved.question === "string") setQuestion(saved.question);
        if (saved.question || saved.turns?.length) setComposerOpen(true);
        setEnded(saved.ended === true);
      } catch { /* A damaged draft starts a fresh experience. */ }
      setLoaded(true);
    }, 0);
    return () => { window.clearTimeout(restore); controller.current?.abort(); recognition.current?.stop(); stopPatientPlayback(); };
  }, [storageKey]);
  useEffect(() => {
    if (loaded) {
      try { localStorage.setItem(storageKey, JSON.stringify({ turns, question, ended })); }
      catch { /* Keep this conversation usable when device storage is full. */ }
    }
  }, [loaded, storageKey, turns, question, ended]);
  const shownTurns: (Turn | TranscriptTurn)[] = [...(scripted?.turns ?? []), ...turns];
  useEffect(() => { if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; }, [shownTurns.length, busy]);
  useEffect(() => { if (composerOpen) questionField.current?.focus(); }, [composerOpen]);
  const pending = turns.at(-1)?.speaker === "student" && !turns.at(-1)?.cancelled ? turns.at(-1)! : null;
  const latest = [...shownTurns].reverse().find(turn => turn.speaker === "patient");
  const speak = (text: string) => speakPatientText(text);
  const replay = (turn: Turn | TranscriptTurn) => {
    if (scripted?.turns.some(source => source.id === turn.id)) scripted.replay(turn.text);
    else speak(turn.text);
  };
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
    if (controller.current || !loaded) return;
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
      const response = await fetch("/api/patient", { method: "POST", headers: { "Content-Type": "application/json" }, signal: request.signal, body: JSON.stringify({ question: text, history, mode: scripted || ended ? "supplemental" : "live" }) });
      const data = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error ?? "患者暂时无法回复，请重试。");
      if (request.signal.aborted) return;
      setTurns(current => current.some(turn => turn.id === `${id}-reply`) ? current : [...current, { id: `${id}-reply`, speaker: "patient", text: data.answer!, time: new Date().toLocaleTimeString("zh-CN") }]);
      speak(data.answer);
    } catch (cause) {
      setError(request.signal.aborted ? "请求已停止或超时，提问已保留，可重试。" : cause instanceof Error ? cause.message : "连接失败，请重试。");
    } finally { window.clearTimeout(timeout); if (controller.current === request) controller.current = null; setBusy(false); }
  };
  const openConversation = () => {
    if (scripted?.canAdvance && scripted.state === "idle" && !composerOpen) {
      scripted.next();
      return;
    }
    scripted?.cancel();
    controller.current?.abort();
    setComposerOpen(true);
    questionField.current?.focus();
  };
  const activity = scripted?.state ?? "idle";
  return <div className="history-layout live-experience unified-patient-chat" aria-label="患者对话">
    <section className="patient-stage">
      <div className={`patient-frame ${speaking ? "speaking" : ""} ${busy || activity === "thinking" ? "thinking" : ""}`}>
        <PatientMedia alt="标准化患者郭曼" />
        <div className="room-badge"><span><i />{scripted ? "历史回放" : "实时交互体验"}</span><small>急诊留观室 · 床旁评估</small></div>
        {scripted && <div className="patient-vitals"><span><small>HR</small><b>97</b></span><span><small>SpO₂</small><b>90%</b></span><span><small>BP</small><b>111/79</b></span></div>}
        <div className="patient-overlay"><span>郭曼</span><small>58岁女性 · 病房</small></div>
        {(busy || activity === "thinking") && <div className="patient-thinking" aria-live="polite"><i /><i /><i /><span>正在思考</span></div>}
      <button type="button" aria-label="患者对话" className={`mic-button patient-dialogue-button ${activity}`} onClick={openConversation}>
        <span aria-hidden="true">●</span><b>患者对话</b>
        <small>{scripted?.canAdvance && !composerOpen && activity === "idle" ? "播放下一轮演示对话" : activity !== "idle" || busy ? "点击停止当前对话并提问" : "点击继续向患者提问"}</small>
      </button>
      </div>
      <PatientMediaTools />
      <div className="recent-audio"><button type="button" aria-label="播放患者最近回答" disabled={!latest} onClick={() => { if (latest) replay(latest); }}>▶</button><div><strong>患者最近回答</strong><span>{latest?.text ?? "点击患者对话开始问诊"}</span></div></div>
      {composerOpen && <div className="experience-compose">
        <label htmlFor={questionId}>向患者提问</label>
        <textarea ref={questionField} id={questionId} value={question} disabled={!loaded || busy || Boolean(pending)} onChange={event => setQuestion(event.target.value)} placeholder="语音提问或输入文字，Ctrl + Enter 发送" rows={3} maxLength={500} onKeyDown={event => { if (!event.nativeEvent.isComposing && event.ctrlKey && event.key === "Enter") { event.preventDefault(); void ask(); } }} />
        <div>
          <button type="button" className="outline-button" onClick={() => listening ? recognition.current?.stop() : startVoice()} disabled={!loaded || busy || Boolean(pending)}>{listening ? "结束录音" : "语音提问"}</button>
          <button type="button" className="primary-button" disabled={!loaded || busy || (!pending && !question.trim())} onClick={() => void ask()}>{pending ? "重试问题" : "发送问题"}</button>
          {scripted?.canAdvance && <button type="button" className="outline-button" disabled={busy || Boolean(pending) || listening} onClick={() => { setComposerOpen(false); scripted.next(); }}>继续演示</button>}
          {!scripted && !ended && <button type="button" className="outline-button" disabled={!loaded || busy || Boolean(pending) || listening} onClick={() => { stopPatientPlayback(); setEnded(true); }}>结束问诊</button>}
        </div>
      </div>}
      {pending && !busy && <button type="button" className="outline-button" onClick={() => { setQuestion(pending.text); setTurns(current => current.map(turn => turn.id === pending.id ? { ...turn, cancelled: true } : turn)); }}>取消未答问题</button>}
      {busy && <button type="button" className="outline-button" onClick={() => controller.current?.abort()}>停止等待</button>}
      {error && <p className="patient-live-error" role="alert">{error}</p>}
    </section>
    <aside className="transcript-panel">
      <div className="transcript-head"><div><span className="live-dot" /><strong>对话记录</strong></div><small>{shownTurns.length} 条</small></div>
      <div className="transcript-list" ref={viewport}>
        {shownTurns.length ? shownTurns.map(turn => <div className={`turn ${turn.speaker}`} key={turn.id}>
          <div><b>{turn.speaker === "student" ? "考生" : "郭曼"}</b><time>{"stage" in turn ? `阶段${turn.stage ?? 1} · 历史回放 · ` : ""}{turn.time}{"cancelled" in turn && turn.cancelled ? " · 已取消" : ""}</time></div>
          <p>{turn.text}</p>{turn.speaker === "patient" && <button type="button" onClick={() => replay(turn)}>▷ 重听</button>}
        </div>) : <div className="transcript-empty"><strong>尚未开始问诊</strong><p>对话将在这里显示。</p></div>}
      </div>
    </aside>
  </div>;
}
