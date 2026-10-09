export const scoringDimensions = [
  { id: "history", title: "病史采集完整性" },
  { id: "physical", title: "体格检查针对性" },
  { id: "auxiliary", title: "辅助检查针对性" },
  { id: "stage", title: "阶段诊断准确性" },
  { id: "final", title: "最终诊断结果准确性" },
  { id: "treatment", title: "治疗方案可行性" },
] as const;
export type ScoringDimensionId = typeof scoringDimensions[number]["id"];
export type DimensionWeights = Record<ScoringDimensionId, number>;
export const defaultDimensionWeights: DimensionWeights = { history: 1, physical: 1, auxiliary: 1, stage: 1, final: 1, treatment: 1 };

export function normalizeWeights(input?: Partial<DimensionWeights>): DimensionWeights {
  const values = Object.fromEntries(scoringDimensions.map(({ id }) => {
    const value = input?.[id];
    return [id, typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : 1];
  })) as DimensionWeights;
  return Object.values(values).some(value => value > 0) ? values : { ...defaultDimensionWeights };
}

// Normalize each dimension before weighting: raw maximums must not determine its influence.
export function weightedScore(dimensions: { id: string; earned: number | null; maximum: number | null }[], input?: Partial<DimensionWeights>): number | null {
  const weights = normalizeWeights(input);
  let numerator = 0, denominator = 0;
  for (const { id } of scoringDimensions) {
    const dimension = dimensions.find(value => value.id === id);
    if (!dimension || dimension.maximum === null || dimension.maximum <= 0 || weights[id] === 0) continue;
    if (dimension.earned === null) return null;
    numerator += Math.max(0, Math.min(1, dimension.earned / dimension.maximum)) * weights[id];
    denominator += weights[id];
  }
  return denominator ? Math.round(numerator / denominator * 1000) / 10 : null;
}

export type RankingEntry = { learnerId: string; name: string; score: number; caseId: string; scoringKey: string };
export function scoringKey(policy: { physicalOrderScoringEnabled: boolean; auxiliaryOrderScoringEnabled: boolean; dimensionWeights?: Partial<DimensionWeights> }) {
  const weights = normalizeWeights(policy.dimensionWeights);
  const sum = Object.values(weights).reduce((value, weight) => value + weight, 0);
  return [policy.physicalOrderScoringEnabled, policy.auxiliaryOrderScoringEnabled, ...scoringDimensions.map(({ id }) => (weights[id] / sum).toFixed(6))].join(":");
}
export function bestScores(entries: RankingEntry[], caseId: string, key: string): RankingEntry[] {
  const best = new Map<string, RankingEntry>();
  for (const entry of entries) {
    if (entry.caseId !== caseId || entry.scoringKey !== key || !Number.isFinite(entry.score) || entry.score < 0 || entry.score > 100) continue;
    if (!best.has(entry.learnerId) || best.get(entry.learnerId)!.score < entry.score) best.set(entry.learnerId, entry);
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.learnerId.localeCompare(b.learnerId));
}
