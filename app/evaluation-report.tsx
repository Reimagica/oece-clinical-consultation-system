"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Attempt, Exam } from "./demo-data";
import { buildDimensions, type ScoredItem } from "./assessment";
import { weightedScore } from "./score-policy";
import VisualReport from "./visual-report";
import "./report-polish.css";

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const needles = [...new Set(terms)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!needles.length) return <>{text}</>;
  const expression = new RegExp(`(${needles.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return <>{text.split(expression).map((part, index) => needles.some(term => term.toLowerCase() === part.toLowerCase()) ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>)}</>;
}

function EvidenceReader({ item, close }: { item: ScoredItem; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); trigger?.focus(); };
  }, []);
  return <dialog ref={dialog} className="evidence-dialog" aria-labelledby="evidence-title" onCancel={close} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="evidence-dialog-inner">
      <header><span>评分证据</span><button type="button" className="outline-button" onClick={close} autoFocus>关闭 ×</button></header>
      <h2 id="evidence-title">{item.label}</h2>
      <section className="evidence-block"><h3>分值</h3><strong>{item.earned === null ? "待复核" : `${item.earned} / ${item.maximum} 分`}</strong>{item.breakdown?.length ? <div className="evidence-breakdown">{item.breakdown.map(part => <span key={part.label}>{part.label} {part.earned === null ? "待复核" : `${part.earned}/${part.maximum} 分`}</span>)}</div> : null}</section>
      <section className="evidence-block"><h3>参考答案</h3><p>{item.reference}</p></section>
      <section className="evidence-block"><h3>评分证据</h3>{item.evidence ? <pre><Highlighted text={item.evidence} terms={item.highlights ?? []} /></pre> : <p>未记录对应作答</p>}{item.chartPending && <div className="chart-placeholder" role="img" aria-label="检查图表待补充"><span aria-hidden="true">▧</span><strong>检查图表</strong><small>图表待补充</small></div>}</section>
      <section className="evidence-block"><h3>评分说明</h3><p>{item.explanation}</p></section>
    </div>
  </dialog>;
}

export default function EvaluationReportView({ role, exam, attempt, go, backPath, allowReplay = true }: {
  role: "teacher" | "student"; exam: Exam | null; attempt: Attempt | null; go: (path: string) => void; backPath?: string; allowReplay?: boolean;
}) {
  const [active, setActive] = useState("history");
  const [view, setView] = useState<"visual" | "evidence">("visual");
  const [selected, setSelected] = useState<ScoredItem | null>(null);
  const dimensions = useMemo(() => exam && attempt ? buildDimensions(exam, attempt) : [], [exam, attempt]);
  if (!exam || !attempt) return <div className="loading-screen">尚无可查看的考试报告</div>;
  const current = dimensions.find(dimension => dimension.id === active) ?? dimensions[0];
  const groups = [...new Set(current.items.map(item => item.group || current.title))];
  const total = weightedScore(dimensions, exam.policy.dimensionWeights);
  const itemButton = (item: ScoredItem, index: number) => <button type="button" key={`${item.label}-${index}`} className={item.missing ? "report-item-missing" : ""} aria-haspopup="dialog" onClick={() => setSelected(item)}><span><b>{item.missing ? `缺少回答：${item.label}` : item.label}</b></span><strong>{item.earned === null ? "待复核" : `${item.earned}/${item.maximum}`} →</strong></button>;
  return <main className="new-report-shell">
    <div className="new-report-top"><div><h1>临床思维评价报告</h1></div><div className="new-report-actions"><button className="outline-button" onClick={() => go(backPath ?? (role === "teacher" ? `/teacher/exams/${exam.id}` : "/student/tasks"))}>{role === "teacher" ? "返回考试" : "返回工作台"}</button>{allowReplay && <button className="primary-button" onClick={() => go(`/student/exam/${attempt.id}/stage/1`)}>回顾考试</button>}</div></div>
    <nav className="report-view-tabs" role="tablist" aria-label="报告视图"><button type="button" id="report-tab-visual" role="tab" aria-selected={view === "visual"} aria-controls="report-panel-visual" className={view === "visual" ? "active" : ""} onClick={() => { setView("visual"); setSelected(null); }}>可视化报告</button><button type="button" id="report-tab-evidence" role="tab" aria-selected={view === "evidence"} aria-controls="report-panel-evidence" className={view === "evidence" ? "active" : ""} onClick={() => setView("evidence")}>评分明细与证据</button></nav>
    {view === "visual" ? <VisualReport exam={exam} attempt={attempt} dimensions={dimensions} score={total} viewDimension={id => { setActive(id); setView("evidence"); }} /> : <div id="report-panel-evidence" role="tabpanel" aria-labelledby="report-tab-evidence">
    <div className="new-report-overview"><div><span>本次综合得分</span><strong>{total === null ? "待复核" : <>{total.toFixed(1)}<small> / 100 分</small></>}</strong></div></div>
    <nav className="new-report-tabs" aria-label="评价维度">{dimensions.map(dimension => <button key={dimension.id} aria-current={dimension.id === current.id ? "page" : undefined} className={dimension.id === current.id ? "active" : ""} onClick={() => { setActive(dimension.id); setSelected(null); }}><span>{dimension.title}</span><b>{dimension.maximum === null ? "不计分" : dimension.earned === null ? "待复核" : `${dimension.earned}/${dimension.maximum}`}</b></button>)}</nav>
    <section className="new-report-content report-full-width"><div className="new-report-main"><div className="new-report-section-head"><div><h2>{current.title}</h2></div><strong>{current.maximum === null ? "—" : `满分 ${current.maximum}`}</strong></div>
      <div className="new-report-list report-group-list">{groups.map(group => <details className="report-rubric-group" key={group} open={groups.length === 1 ? true : undefined}><summary><span>{group}</span><small>{current.items.filter(item => item.group === group).length || current.items.length} 项</small></summary><div>{current.items.filter(item => (item.group || current.title) === group).map(itemButton)}</div></details>)}</div>
    </div></section></div>}
    {selected && <EvidenceReader item={selected} close={() => setSelected(null)} />}
  </main>;
}
