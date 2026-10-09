"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { OrderedCheckItem } from "./demo-data";
import { duplicateChecks } from "./case-checks";
import { canGenerateCheck, clearCheckResult, type CheckKind, type CheckResult } from "./check-results";

export default function SequentialCheckTable({ kind, items, editable, onChange, renderName }: {
  kind: CheckKind; items: OrderedCheckItem[]; editable: boolean;
  onChange: (items: OrderedCheckItem[]) => void;
  renderName: (item: OrderedCheckItem, index: number, update: (name: string) => void, disabled: boolean) => ReactNode;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const latest = useRef(items);
  useEffect(() => { latest.current = items; }, [items]);
  useEffect(() => () => controller.current?.abort(), []);
  const locked = !editable || !!busy;
  const write = (next: OrderedCheckItem[]) => { onChange(next); };
  const move = (from: number, to: number) => {
    if (locked || to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [row] = next.splice(from, 1); next.splice(to, 0, row); write(next);
  };
  const generate = async (item: OrderedCheckItem, index: number) => {
    if (locked || controller.current || !canGenerateCheck(items, index) || duplicateChecks(items)) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(item.id); setError(null);
    try {
      const response = await fetch("/api/checks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, label: item.label }), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(22_000)]) });
      const payload = await response.json() as { result?: CheckResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? "结果生成失败，请重试。");
      if (abort.signal.aborted) return;
      write(latest.current.map(row => row.id === item.id && row.label === item.label ? { ...row, result: payload.result, generatedAt: new Date().toISOString() } : row));
    } catch (cause) {
      if (!abort.signal.aborted) setError({ id: item.id, message: cause instanceof Error && cause.name !== "TimeoutError" ? cause.message : "结果生成超时，请重试。" });
    } finally {
      if (!abort.signal.aborted) { controller.current = null; setBusy(null); }
    }
  };
  return <section className="sequential-checks" aria-label={kind === "physical" ? "体格检查作答表" : "辅助检查作答表"}>
    <div className="check-table-help"><span>依次填写项目 → 生成结果 → 分析结果</span><small>可增删、修改或调整顺序</small></div>
    <div className="check-table-scroll"><table className="check-answer-table"><thead><tr><th scope="col">顺序</th><th scope="col">检查项目</th><th scope="col">检查结果</th><th scope="col">结果分析</th><th scope="col">操作</th></tr></thead><tbody>
      {items.map((item, index) => <tr key={item.id} className={busy === item.id ? "generating" : ""} onDragOver={event => { if (dragged) event.preventDefault(); }} onDrop={event => { event.preventDefault(); const from = items.findIndex(row => row.id === dragged); if (from >= 0) move(from, index); setDragged(null); }}>
        <td className="check-order"><span draggable={!locked} onDragStart={() => setDragged(item.id)} onDragEnd={() => setDragged(null)} aria-hidden="true" className="row-drag">⠿</span><b>{index + 1}</b><div><button type="button" aria-label={`上移检查 ${index + 1}`} disabled={locked || index === 0} onClick={() => move(index, index - 1)}>↑</button><button type="button" aria-label={`下移检查 ${index + 1}`} disabled={locked || index === items.length - 1} onClick={() => move(index, index + 1)}>↓</button></div></td>
        <td data-label="检查项目"><div className="check-name-control">{renderName(item, index, label => { setError(null); write(items.map(row => row.id === item.id ? clearCheckResult(row, label) : row)); }, locked)}
          {editable && <button type="button" className="outline-button generate-check" disabled={!!busy || !!item.result || !canGenerateCheck(items, index) || duplicateChecks(items)} onClick={() => generate(item, index)}>{busy === item.id ? "正在生成…" : item.result ? "已生成" : "生成结果"}</button>}
          </div>{!item.result && index > 0 && !canGenerateCheck(items, index) && <small className="check-waiting">请先完成前一项检查</small>}
          {error?.id === item.id && <p className="check-error" role="alert">{error.message}</p>}
        </td>
        <td data-label="检查结果">{item.result ? <div className="check-result-content">
          {item.result.rows ? <table className="check-lab-table"><thead><tr>{["项目", "结果", "单位", "参考范围"].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead><tbody>{item.result.rows.map(row => <tr key={row[0]}>{row.map((cell, n) => <td key={n}>{cell}</td>)}</tr>)}</tbody></table> : <p>{item.result.text}</p>}
          {item.result.image && <img src={item.result.image.src} alt={item.result.image.alt} loading="lazy" />}
          {item.result.chart === "ecg" && <div className="chart-placeholder"><span aria-hidden="true">▧</span><span>心电图图表待补充</span></div>}
        </div> : <p className="check-result-empty">{busy === item.id ? "正在进行本项检查…" : "填写项目后生成结果"}</p>}</td>
        <td data-label="结果分析"><textarea aria-label={`检查 ${index + 1} 结果分析`} disabled={!editable || !item.result || item.result.kind === "clarification"} value={item.interpretation} placeholder={item.result ? "填写本项检查的结果分析…" : "生成结果后填写分析…"} onChange={event => write(items.map(row => row.id === item.id ? { ...row, interpretation: event.target.value } : row))} /></td>
        <td className="check-row-actions"><button type="button" className="delete-check" disabled={locked} aria-label={`删除检查 ${index + 1}`} onClick={() => { setError(null); write(items.filter(row => row.id !== item.id)); }}>删除</button></td>
      </tr>)}
    </tbody></table></div>
    {duplicateChecks(items) && <p role="alert" className="check-error">检查项目重复，请修改或删除重复项。</p>}
    {editable && <button type="button" className="add-row-button" disabled={!!busy} onClick={() => write([...items, { id: `${kind}-${crypto.randomUUID()}`, label: "", interpretation: "" }])}>＋ 新增一行</button>}
  </section>;
}
