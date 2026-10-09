"use client";
import { useEffect, useMemo, useState } from "react";
import type { Attempt, Exam } from "./demo-data";
import type { Dimension } from "./assessment";
import DimensionRadar from "./dimension-radar";
import { bestScores, scoringKey, type RankingEntry } from "./score-policy";

function LearnerAvatar() {
  return <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="14" r="7" /><path d="M7 36v-3a13 13 0 0 1 26 0v3Z" /></svg>;
}

function TrophyIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3h10v5a5 5 0 0 1-10 0V3Zm0 2H3v2a4 4 0 0 0 5 4m9-6h4v2a4 4 0 0 1-5 4M12 13v5m-4 3h8m-7-3h6v3H9Z" /></svg>;
}

const BEST_KEY = "aimed-oece-personal-best-v1";
function readBest(): RankingEntry[] {
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(BEST_KEY) ?? "[]");
    if (!Array.isArray(data)) return [];
    return data.filter((entry): entry is RankingEntry => entry && typeof entry.learnerId === "string" && typeof entry.name === "string" && typeof entry.caseId === "string" && typeof entry.scoringKey === "string" && typeof entry.score === "number" && Number.isFinite(entry.score) && entry.score >= 0 && entry.score <= 100);
  } catch { return []; }
}

export default function VisualReport({ exam, attempt, dimensions, score, viewDimension }: {
  exam: Exam; attempt: Attempt; dimensions: Dimension[]; score: number | null; viewDimension: (id: string) => void;
}) {
  const [savedBest, setSavedBest] = useState<RankingEntry[]>([]);
  const [saveError, setSaveError] = useState(false);
  const key = scoringKey(exam.policy);
  useEffect(() => {
    let entries = readBest();
    let failed = false;
    if (attempt.status === "submitted" && score !== null) {
      const entry = { learnerId: exam.studentId, name: "我", score, caseId: exam.caseId, scoringKey: key };
      const previous = entries.find(row => row.learnerId === entry.learnerId && row.caseId === entry.caseId && row.scoringKey === entry.scoringKey);
      if (!previous || entry.score > previous.score) {
        entries = [...entries.filter(row => row !== previous), entry];
        try { window.localStorage.setItem(BEST_KEY, JSON.stringify(entries)); } catch { failed = true; }
      }
    }
    const timer = window.setTimeout(() => { setSavedBest(entries); setSaveError(failed); }, 0);
    return () => window.clearTimeout(timer);
  }, [score, key, exam.studentId, exam.caseId, attempt.status]);
  const currentEntry: RankingEntry[] = attempt.status === "submitted" && score !== null ? [{ learnerId: exam.studentId, name: "我", score, caseId: exam.caseId, scoringKey: key }] : [];
  // Deliberate duplicates exercise one-highest-score-per-learner behavior in the demo.
  const seeds = [
    { learnerId: "demo-002", name: "模拟学员 002", score: 94.6 },
    { learnerId: "demo-002", name: "模拟学员 002", score: 89.2 },
    { learnerId: "demo-003", name: "模拟学员 003", score: 91.8 },
    { learnerId: "demo-004", name: "模拟学员 004", score: 88.5 },
    { learnerId: "demo-005", name: "模拟学员 005", score: 85.3 },
    { learnerId: "demo-006", name: "模拟学员 006", score: 81.7 },
  ].map(entry => ({ ...entry, caseId: exam.caseId, scoringKey: key }));
  const ranking = bestScores([...seeds, ...savedBest, ...currentEntry], exam.caseId, key);
  const own = ranking.find(entry => entry.learnerId === exam.studentId);
  const ownRank = own ? ranking.indexOf(own) + 1 : null;
  const priorities = useMemo(() => dimensions.filter(dimension => dimension.maximum && dimension.earned !== null && dimension.earned < dimension.maximum).toSorted((a, b) => a.earned! / a.maximum! - b.earned! / b.maximum!).slice(0, 2), [dimensions]);
  return <section id="report-panel-visual" role="tabpanel" aria-labelledby="report-tab-visual" className="visual-report-grid">
    <div>
      <section className="visual-score-card"><div className="score-number"><span>本次综合得分</span><strong>{score === null ? "待复核" : score.toFixed(1)}</strong>{score !== null && <span>/ 100 分</span>}</div><div className="report-case-name">{exam.caseName}</div></section>
      <DimensionRadar dimensions={dimensions} />
      <section className="visual-dimension-card"><div className="new-report-section-head"><h2>维度表现</h2></div>
        <div className="dimension-bars">
        {dimensions.map(dimension => {
          const ratio = dimension.maximum && dimension.earned !== null ? Math.max(0, Math.min(1, dimension.earned / dimension.maximum)) : null;
          return <div className="dimension-bar" key={dimension.id}><button type="button" onClick={() => viewDimension(dimension.id)} aria-label={`查看${dimension.title}评分依据`}><div className="dimension-bar-head"><b>{dimension.title}</b><span className="dimension-arrow" aria-hidden="true">↗</span></div><strong className="dimension-value">{dimension.maximum === null ? "暂不计分" : dimension.earned === null ? "待复核" : `${dimension.earned} / ${dimension.maximum} 分`}</strong>{ratio !== null && <div className="dimension-track" aria-hidden="true"><span style={{ width: `${ratio * 100}%` }} /></div>}</button></div>;
        })}
        </div>
      </section>
      <section className="visual-feedback"><h2>下一步练习重点</h2><div className="practice-priorities">{priorities.length ? priorities.map((dimension, index) => <button type="button" className="practice-priority" key={dimension.id} onClick={() => viewDimension(dimension.id)} aria-label={`查看${dimension.title}练习重点`}><span className="practice-number" aria-hidden="true">0{index + 1}</span><span className="practice-title">{dimension.title}</span><span className="practice-action">查看依据 <span aria-hidden="true">→</span></span></button>) : <p>{score === null ? "评分待复核" : "本次无缺答项"}</p>}</div></section>
    </div>
    <aside className="report-leaderboard"><header className="leaderboard-heading"><span className="leaderboard-emblem"><TrophyIcon /></span><h2>本病例排行榜</h2><span className="leaderboard-top">TOP 5</span></header><ol>{ranking.slice(0, 5).map((entry, index) => <li key={entry.learnerId} className={`${index < 3 ? `rank-podium rank-${index + 1}` : "rank-standard"}${entry.learnerId === exam.studentId ? " rank-own" : ""}`}><span className="rank-identity">{index < 3 && <span className="rank-avatar"><LearnerAvatar /></span>}<b className="rank-position">{index < 3 ? `NO.${index + 1}` : index + 1}</b></span><span className="rank-name">{entry.learnerId === exam.studentId ? "我" : entry.name}</span><strong className="leader-score">{entry.score.toFixed(1)}</strong></li>)}</ol><div className="personal-best"><span>我的最高分</span><strong>{own ? own.score.toFixed(1) : "待复核"}</strong>{own && <span>第 {ownRank} 名</span>}</div>{saveError && <p role="alert" className="check-error">最高分未能保存，请检查本机存储权限。</p>}</aside>
  </section>;
}
