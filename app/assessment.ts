import type { Attempt, Exam, TranscriptTurn } from "./demo-data";
import { canonicalCheck, normalizeCheck, checkResultText } from "./case-checks";
import { caseSummaryRubric, diagnosticEvidenceRubric, historyRubric, treatmentRubric, type WordRubricItem } from "./heart-failure-rubric";

export type ScoredItem = {
  label: string; group?: string; earned: number | null; maximum: number;
  reference: string; evidence?: string; explanation: string;
  highlights?: string[]; breakdown?: { label: string; earned: number | null; maximum: number }[];
  missing?: boolean; chartPending?: boolean;
};
export type Dimension = { id: string; title: string; earned: number | null; maximum: number | null; items: ScoredItem[] };

const physicalRubric = [
  { label: "心脏听诊", item: 10, order: 5 }, { label: "双肺听诊", item: 10, order: 5 },
  { label: "颈静脉怒张检查", item: 5, order: 3 }, { label: "肝颈静脉回流征", item: 5, order: 3 },
  { label: "下肢水肿检查", item: 3, order: 1 }, { label: "腹部视诊", item: 0, order: 0 },
];
const auxiliaryRubric = [
  { label: "NT-proBNP", item: 7, order: 3 }, { label: "胸部X线", item: 7, order: 3 },
  { label: "动脉血气分析", item: 5, order: 2 }, { label: "心电图", item: 5, order: 2 },
  { label: "血生化", item: 5, order: 2 }, { label: "血常规", item: 2, order: 1 },
  { label: "肝功能", item: 2, order: 1 }, { label: "心肺运动试验", item: 2, order: 1 },
  { label: "甲状腺功能", item: 0, order: 0 },
];
const norm = (value: string) => normalizeCheck(canonicalCheck(value));
const sum = (items: ScoredItem[]) => items.some(item => item.earned === null) ? null : items.reduce((total, item) => total + (item.earned ?? 0), 0);
const max = (items: ScoredItem[]) => items.reduce((total, item) => total + item.maximum, 0);

function scoreChecks(selected: Attempt["physicalItems"], rubric: typeof physicalRubric, orderEnabled: boolean): ScoredItem[] {
  const names = selected.map(item => norm(item.label));
  return rubric.filter(rule => rule.item > 0).map(rule => {
    const position = names.indexOf(norm(rule.label));
    const answer = position >= 0 ? selected[position] : null;
    const higher = rubric.filter(other => other.item > rule.item);
    const higherMissing = higher.some(other => !names.includes(norm(other.label)));
    const correctOrder = answer && !higherMissing && higher.every(other => names.indexOf(norm(other.label)) < position);
    const itemEarned = answer ? rule.item : 0;
    const orderEarned = !orderEnabled ? 0 : answer && higherMissing ? null : correctOrder ? rule.order : 0;
    const result = answer ? answer.result?.text ?? checkResultText(answer.label) : "";
    return {
      label: rule.label, earned: orderEarned === null ? null : itemEarned + orderEarned,
      maximum: rule.item + (orderEnabled ? rule.order : 0), group: "检查项目",
      reference: `${rule.label}${result ? `\n检查结果：${result}` : ""}`,
      evidence: answer ? `第 ${position + 1} 顺位：${answer.label}${answer.generatedAt ? `\n结果生成时间：${answer.generatedAt}` : ""}${result ? `\n开放结果：${result}` : ""}${answer.interpretation ? `\n结果分析：${answer.interpretation}` : ""}` : undefined,
      explanation: !answer ? "未选择该检查项目。" : orderEarned === null ? "检查项目已选择；顺序分需结合缺少的高优先级项目复核。" : "根据检查选择和提交顺序计分。",
      breakdown: [{ label: "项目", earned: itemEarned, maximum: rule.item }, ...(orderEnabled ? [{ label: "顺序", earned: orderEarned, maximum: rule.order }] : [])],
      missing: !answer, chartPending: rule.label === "心电图",
    };
  });
}

// Question keywords are matched only against the student's question. Patient answers are quoted as evidence, never used to infer that a question was asked.
const historyHints: RegExp[][] = [
  [/咳嗽/], [/呼吸困难|气短|喘/], [/加重|多久|多长时间|几个月/], [/首发|开始|几年|什么时候/],
  [/活动|运动|走路/], [/干咳|痰/], [/间歇|频率|经常|多久一次/], [/反复|发作/],
  [/寒冷|天气|受凉/], [/诱因|全天|任何时候/], [/持续/], [/夜间|晚上/], [/痰量|多少痰/],
  [/痰色|白色|透明/], [/登楼|爬山|上楼|爬楼/], [/平地|走路/], [/休息|缓解/], [/夜间|入睡|睡觉/],
  [/双侧|两侧|两边/], [/间歇|时有时无/], [/踝|脚踝/], [/乏力|无力/],
  [/咯血|心悸|出汗|发热|胸痛|发绀|喘息/], [/膝|麻木/], [/腰背|背痛|钝痛/],
  [/就诊|看过|治疗过/], [/食欲|胃口/], [/体重/], [/小便|排尿/], [/心梗|支架|冠脉/],
  [/哮喘/], [/高血压|高脂|糖尿病|肾病/], [/复诊|随访/], [/过敏|磺胺/], [/吸烟|抽烟/],
  [/运动|锻炼|行走/], [/绝经|月经/], [/父|母|家族/], [/父|肺癌/], [/母|心脏病/], [/需求|还有什么|还有其他|谢谢/],
];
function historyEvidence(turns: TranscriptTurn[], index: number) {
  const hint = historyHints[index];
  const found: { question: TranscriptTurn; reply?: TranscriptTurn; keyword: string }[] = [];
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.mode === "live" || turn.speaker !== "student" || turn.status === "cancelled") continue;
    const match = hint.flatMap(pattern => [...turn.text.matchAll(new RegExp(pattern.source, "gi"))])[0];
    if (match) found.push({ question: turn, reply: turns[i + 1]?.speaker === "patient" ? turns[i + 1] : undefined, keyword: match[0] });
  }
  return found.slice(0, index === 22 ? 7 : 3);
}
function scoreHistory(turns: TranscriptTurn[]): ScoredItem[] {
  return historyRubric.map((rule, index) => {
    const matches = historyEvidence(turns, index);
    const isSeven = index === 22;
    const symptoms = ["咯血", "心悸", "出汗", "发热", "胸痛", "发绀", "喘息"];
    const count = isSeven ? symptoms.filter(term => turns.some(turn => turn.speaker === "student" && turn.mode !== "live" && turn.text.includes(term))).length : 0;
    const earned = isSeven ? count : matches.length ? rule.max : 0;
    const excerpt = matches.map(({ question, reply }) => `考生：${question.text}${reply ? `\n患者：${reply.text}` : ""}`).join("\n\n");
    return { label: rule.label, group: rule.section, maximum: rule.max, earned, reference: rule.label,
      evidence: excerpt || undefined, highlights: isSeven ? symptoms.filter(term => matches.some(match => match.question.text.includes(term))) : matches.map(match => match.keyword),
      explanation: earned === rule.max ? "提问涵盖该要点。" : earned ? `提问涵盖 ${count} 项相关症状。` : "对话中未找到针对该要点的提问。", missing: earned === 0 };
  });
}

// A small, explicit lexicon keeps demo scoring explainable. Negated mentions are not counted as positive evidence.
const summaryTerms: RegExp[][] = [
  [/58岁|58 岁|中年/ , /女/], [/冠心病|冠状动脉|心梗/, /高血压/], [/咳嗽/], [/加重|进行性/],
  [/劳力性|活动后|活动性/, /呼吸困难|气短/], [/低氧|氧饱和度低|SpO₂.*90/], [/左心室|左室/, /容量|负荷/],
  [/二尖瓣|心尖/, /杂音/], [/NT-proBNP|脑钠肽/i, /升高|增高/], [/胸片|X线|影像/, /肺水肿|肺淤血/],
];
const evidenceTerms: RegExp[][] = [
  [/颈静脉怒张/, /肝颈静脉回流征|颈静脉回流征/, /下肢水肿|踝.*水肿/], [/双肺|肺底/, /啰音/],
  [/\b(?:NT-pro)?BNP\b/i, /升高|增高/], [/转氨酶|肝功能/, /升高|异常/], [/胸片|胸部X线/, /肺淤血/],
  [/胸腔积液/], [/心肺运动试验/, /低氧/], [/心尖/, /杂音/],
];
const treatmentTerms: RegExp[][] = [
  [/限钠|低盐|限制钠/, /限水|限制饮水|限制钠盐和水|限制钠盐及液体/, /吸氧|氧疗/], [/利尿|呋塞米|醛固酮/],
  [/SGLT2|钠葡萄糖协同转运蛋白/i], [/β受体阻滞剂|β阻滞剂|美托洛尔|比索洛尔/], [/ACEI|ARB|ARNI|沙库巴曲|缬沙坦/i],
];
function positiveMatch(text: string, pattern: RegExp): string | null {
  for (const match of text.matchAll(new RegExp(pattern.source, `${pattern.flags.replace(/g/g, "")}g`))) {
    const prefix = text.slice(Math.max(0, match.index - 8), match.index).split(/[，。；;\n]/).at(-1) ?? "";
    if (!/(?:无|未|不|否认|排除|没有|正常|停止|停用|未见|未给予|不使用)[^，。；;\n]*$/.test(prefix)) return match[0];
  }
  return null;
}
function scoreText(rubric: WordRubricItem[], text: string, terms: RegExp[][], group: string): ScoredItem[] {
  return rubric.map((rule, index) => {
    const found = terms[index].map(pattern => positiveMatch(text, pattern));
    const earned = found.every(Boolean) ? rule.max : 0;
    return { label: rule.label, group, earned, maximum: rule.max, reference: rule.label,
      evidence: text.trim() || undefined, highlights: found.filter((term): term is string => Boolean(term)),
      explanation: earned ? "提交内容包含该要点。" : "提交内容未完整包含该要点。", missing: !text.trim() };
  });
}

function scoreStage(entries: Attempt["historyDiagnoses"], stage: string): ScoredItem[] {
  const rubric = [{ name: "急性失代偿性心力衰竭", diagnosis: stage === "初步诊断" ? 3 : 5, order: 2 },
    { name: "间质性肺病", diagnosis: 2, order: 1 },
    { name: "慢性阻塞性肺疾病IV级", diagnosis: stage === "初步诊断" ? 1 : 0, order: stage === "初步诊断" ? 1 : 0 }];
  return rubric.filter(rule => rule.diagnosis > 0).map((rule, index) => {
    const position = entries.findIndex(entry => entry.name.trim() === rule.name);
    const diagnosis = position < 0 ? 0 : rule.diagnosis;
    const order = position === index ? rule.order : 0;
    return { label: rule.name, group: stage, earned: diagnosis + order, maximum: rule.diagnosis + rule.order,
      reference: `${stage}：${rule.name}（第 ${index + 1} 位）`,
      evidence: position < 0 ? undefined : `第 ${position + 1} 位：${entries[position].name}`,
      explanation: position < 0 ? "未填写该诊断。" : position === index ? "诊断名称和顺序符合参考答案。" : "诊断名称符合参考答案，顺序不同。",
      breakdown: [{ label: "诊断", earned: diagnosis, maximum: rule.diagnosis }, { label: "顺序", earned: order, maximum: rule.order }], missing: position < 0 };
  });
}

export function buildDimensions(exam: Exam, attempt: Attempt): Dimension[] {
  const transcript = attempt.transcript.filter(turn => turn.mode !== "live");
  const history = scoreHistory(transcript);
  const physical = scoreChecks(attempt.physicalItems, physicalRubric, exam.policy.physicalOrderScoringEnabled);
  const auxiliary = scoreChecks(attempt.auxiliaryItems, auxiliaryRubric, exam.policy.auxiliaryOrderScoringEnabled);
  const stage = [...scoreStage(attempt.historyDiagnoses, "初步诊断"), ...scoreStage(attempt.physicalDiagnoses, "诊断修正")];
  const summary = scoreText(caseSummaryRubric, attempt.casePresentation, summaryTerms, "病例汇报");
  const primary = attempt.finalDiagnoses.find(entry => entry.isPrimary && entry.name.trim());
  const finalDiagnosis: ScoredItem = { label: "最终诊断", group: "最终诊断", earned: primary?.name === "急性失代偿性心力衰竭" ? 30 : 0, maximum: 30,
    reference: "急性失代偿性心力衰竭", evidence: primary ? `主要诊断：${primary.name}${primary.support ? `\n支持点：${primary.support}` : ""}` : undefined,
    explanation: primary?.name === "急性失代偿性心力衰竭" ? "主要诊断与参考答案一致。" : "主要诊断未与参考答案一致。", missing: !primary };
  const supports = attempt.finalDiagnoses.map(entry => entry.support).filter(Boolean).join("\n");
  const diagnostic = scoreText(diagnosticEvidenceRubric, supports, evidenceTerms, "诊断依据");
  const treatmentText = [attempt.plan, attempt.treatment].filter(Boolean).join("\n");
  const treatment = scoreText(treatmentRubric, treatmentText, treatmentTerms, "治疗方案与诊疗计划");
  const reasoningText = transcript.map(turn => `${turn.speaker === "student" ? "考生" : "患者"}：${turn.text}`).join("\n");
  return [
    { id: "history", title: "病史采集完整性", earned: sum(history), maximum: max(history), items: history },
    { id: "physical", title: "体格检查针对性", earned: sum(physical), maximum: max(physical), items: physical },
    { id: "auxiliary", title: "辅助检查针对性", earned: sum(auxiliary), maximum: max(auxiliary), items: auxiliary },
    { id: "stage", title: "阶段诊断准确性", earned: sum(stage), maximum: max(stage), items: stage },
    { id: "final", title: "最终诊断结果准确性", earned: sum([...summary, finalDiagnosis, ...diagnostic]), maximum: 90, items: [...summary, finalDiagnosis, ...diagnostic] },
    { id: "treatment", title: "治疗方案可行性", earned: sum(treatment), maximum: max(treatment), items: treatment },
    { id: "reasoning", title: "病史采集推理性", earned: null, maximum: null, items: [{ label: "问诊过程", earned: null, maximum: 0, reference: "完整问诊过程", evidence: reasoningText || undefined, explanation: "该维度由教师结合问诊过程评价。" }] },
  ];
}
