import { defaultExamPolicy, emptyAttempt, type Attempt, type DemoState } from "./demo-data";
import { fixedCheckResult } from "./check-results";
import { normalizeWeights } from "./score-policy";

// Submitted attempts are immutable, including late network/timer callbacks.
export function updateActiveAttempt(state: DemoState, updater: (attempt: Attempt) => Attempt): DemoState {
  if (!state.attempt || state.attempt.status === "submitted") return state;
  return { ...state, attempt: updater(state.attempt) };
}

export function restoreDemoState(raw: string): DemoState {
  const saved = JSON.parse(raw) as DemoState;
  if (!saved || !["teacher", "student"].includes(saved.role)) throw new Error("无效的记录格式");
  if (saved.attempt) {
    const a = saved.attempt;
    if (!saved.exam || a.examId !== saved.exam.id || ![1, 2, 3, 4].includes(a.currentStage) || !["not_started", "in_progress", "submitted"].includes(a.status)) throw new Error("考试记录不完整");
    for (const key of ["transcript", "physicalItems", "auxiliaryItems", "historyDiagnoses", "physicalDiagnoses", "finalDiagnoses", "completedStages"] as const) {
      if (!Array.isArray(a[key])) throw new Error("作答记录不完整");
    }
    saved.attempt = { ...emptyAttempt(a.examId), ...a, transcript: a.transcript.filter(turn => turn.mode !== "live"), patientDraft: "", historyNotes: { ...emptyAttempt(a.examId).historyNotes, ...a.historyNotes } };
    const restored = saved.attempt;
    for (const key of ["historyDiagnoses", "physicalDiagnoses", "finalDiagnoses"] as const) {
      restored[key] = restored[key].map(entry => ({ ...entry, name: entry.name === "慢性阻塞性肺疾病I级" || entry.name === "慢性阻塞性肺疾病一级" ? "慢性阻塞性肺疾病IV级" : entry.name }));
    }
    // Upgrade the former all-at-once reveal without discarding notes or interpretations.
    restored.physicalItems = restored.physicalItems.map(item => !item.result && a.physicalRevealed && item.label.trim() ? { ...item, result: fixedCheckResult("physical", item.label) } : item);
    restored.auxiliaryItems = restored.auxiliaryItems.map(item => !item.result && a.auxiliaryRevealed && item.label.trim() ? { ...item, result: fixedCheckResult("auxiliary", item.label) } : item);
  }
  return { ...saved, exam: saved.exam ? { ...saved.exam, policy: { ...defaultExamPolicy, ...saved.exam.policy, dimensionWeights: normalizeWeights(saved.exam.policy?.dimensionWeights) } } : null };
}
