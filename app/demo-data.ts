import { physicalFindings, laboratoryResults } from "./case-checks";
import { heartFailureDialogue } from "./heart-failure-dialogue";
import type { DimensionWeights } from "./score-policy";
import type { CheckResult } from "./check-results";

export type Role = "teacher" | "student";
export type AttemptStatus = "not_started" | "in_progress" | "submitted";
export type PatientVoiceId =
  | "male-young"
  | "male-middle"
  | "male-senior"
  | "female-young"
  | "female-middle"
  | "female-senior";

export interface ExamPolicy {
  dimensionWeights?: DimensionWeights;
  allowHistoryReview: boolean;
  allowSupplementalHistory: boolean;
  physicalOrderScoringEnabled: boolean;
  auxiliaryOrderScoringEnabled: boolean;
}

export const defaultExamPolicy: ExamPolicy = {
  allowHistoryReview: true,
  allowSupplementalHistory: true,
  physicalOrderScoringEnabled: true,
  auxiliaryOrderScoringEnabled: true,
};

export interface PatientProfile {
  name: string;
  gender: "男" | "女" | "未知";
  age: number;
  occupation: string;
  maritalStatus: string;
  chiefComplaint: string;
  presentIllness: string;
  pastHistory: string;
  personalHistory: string;
  familyHistory: string;
  allergyHistory: string;
  physicalExam: string;
  auxiliaryExam: string;
  appearanceDescription: string;
  avatarStatus: "idle" | "generating" | "ready";
  voiceId: PatientVoiceId;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  caseId: string;
  caseName: string;
  studentId: string;
  studentName: string;
  status: "published";
  publishedAt: string;
  policy: ExamPolicy;
  patientProfile: PatientProfile;
}

export interface TranscriptTurn {
  sourceTurn?: number;
  sourceTime?: string;
  status?: "cancelled";
  id: string;
  speaker: "student" | "patient";
  text: string;
  time: string;
  stage?: number;
  mode?: "scripted" | "live";
}

export interface OrderedCheckItem {
  id: string;
  label: string;
  interpretation: string;
  result?: CheckResult;
  generatedAt?: string;
}

export interface DiagnosisEntry {
  id: string;
  name: string;
  support: string;
  isPrimary: boolean;
}

export interface SearchLibraryItem {
  name: string;
  keywords: string[];
  code?: string;
}

export type EvaluationStatus = "获得" | "部分获得" | "未获得";

export type QuestionCode =
  | "SS"
  | "LO"
  | "RQ"
  | "QD"
  | "RRRI"
  | "SRO"
  | "SRT"
  | "CP"
  | "FQ"
  | "CR"
  | "CC"
  | "OS";

export interface EvidenceRef {
  id: string;
  stage: 1 | 2 | 3 | 4;
  turn?: number;
  field?: string;
  label: string;
  student: string;
  response?: string;
  contextBefore?: string;
  contextAfter?: string;
  linkedCriteria: string[];
  conflict?: string;
}

export interface RubricCriterion {
  id: string;
  title: string;
  standard: string;
  status: EvaluationStatus;
  earned: number;
  max: number;
  feedback: string;
  evidenceIds: string[];
}

export interface HistoryCompletenessSection {
  id: string;
  group: "问诊内容" | "问诊技巧";
  title: string;
  criteria: RubricCriterion[];
}

export interface DiagnosisStageReview {
  stage: "病史采集后" | "体格检查后";
  diagnoses: Array<{
    name: string;
    change: "继承" | "新增" | "删除" | "排序变化";
    judgement: string;
    score: number;
    evidenceIds: string[];
  }>;
}

export interface FinalDiagnosisChecklist {
  total: number;
  maximum: number;
  normalizedScore: number;
  criteria: RubricCriterion[];
}

export interface IdeaDomainReview {
  code: "D" | "E" | "A";
  title: string;
  score: number;
  maximum: 2;
  comment: string;
  evidenceIds: string[];
  includedInOverall: false;
}

export interface TreatmentReview {
  id: string;
  title: string;
  status: EvaluationStatus;
  earned: number;
  max: number;
  standard: string;
  feedback: string;
  evidenceIds: string[];
}

export interface DimensionEvaluation {
  id: "history-completeness" | "history-reasoning" | "physical-targeting" | "auxiliary-targeting" | "stage-diagnosis" | "final-diagnosis" | "treatment";
  shortLabel: string;
  title: string;
  indicatorType: "结果性" | "过程性";
  score: number;
  summary: string;
  includedInOverall: boolean;
  visibility: "all" | "teacher";
}

export interface EvaluationReport {
  id: string;
  attemptId: string;
  status: "系统初评";
  overallScore: number;
  dimensions: DimensionEvaluation[];
  evidence: EvidenceRef[];
  historySections: HistoryCompletenessSection[];
  questionCodes: Record<QuestionCode, { name: string; group: string; definition: string }>;
  turnCodes: Record<number, QuestionCode[]>;
  stageDiagnosisReviews: DiagnosisStageReview[];
  finalDiagnosisChecklist: FinalDiagnosisChecklist;
  ideaReviews: IdeaDomainReview[];
  treatmentReviews: TreatmentReview[];
}

export interface Attempt {
  patientDraft?: string;
  demoFilled?: boolean;
  id: string;
  examId: string;
  status: AttemptStatus;
  startedAt?: string;
  submittedAt?: string;
  currentStage: number;
  completedStages: number[];
  transcript: TranscriptTurn[];
  physicalItems: OrderedCheckItem[];
  physicalRevealed: boolean;
  auxiliaryItems: OrderedCheckItem[];
  auxiliaryRevealed: boolean;
  historyNotes: {
    chiefComplaint: string;
    presentIllness: string;
    pastHistory: string;
    personalHistory: string;
    familyHistory: string;
    other: string;
  };
  historyDiagnoses: DiagnosisEntry[];
  physicalDiagnoses: DiagnosisEntry[];
  finalDiagnoses: DiagnosisEntry[];
  plan: string;
  treatment: string;
  casePresentation: string;
  draft: string;
}

export interface DemoState {
  role: Role;
  exam: Exam | null;
  attempt: Attempt | null;
}

export const stages = [
  "重点病史采集",
  "体格检查",
  "辅助检查",
  "病例汇报与诊疗计划",
];

export const physicalCheckLibrary: SearchLibraryItem[] = [
  { name: "生命体征", keywords: ["体温", "脉搏", "呼吸", "血压"] },
  { name: "心脏听诊", keywords: ["心音", "杂音", "奔马律"] },
  { name: "双肺听诊", keywords: ["肺部", "啰音", "湿啰音"] },
  { name: "颈静脉怒张检查", keywords: ["颈静脉", "JVP"] },
  { name: "肝颈静脉回流征", keywords: ["肝颈静脉", "回流征"] },
  { name: "下肢水肿检查", keywords: ["踝部", "凹陷性水肿", "足背"] },
  { name: "腹部视诊", keywords: ["腹部", "手术瘢痕"] },
];

export const auxiliaryCheckLibrary: SearchLibraryItem[] = [
  { name: "NT-proBNP", keywords: ["BNP", "心功能", "脑钠肽"] },
  { name: "胸部X线", keywords: ["胸片", "X线", "肺水肿"] },
  { name: "动脉血气分析", keywords: ["血气", "氧分压", "PaO2"] },
  { name: "心电图", keywords: ["ECG", "心律", "左室肥厚"] },
  { name: "血生化", keywords: ["肾功能", "电解质", "肌酐", "HbA1c"] },
  { name: "血常规", keywords: ["白细胞", "血红蛋白", "血小板"] },
  { name: "肝功能", keywords: ["转氨酶", "ALT", "AST"] },
  { name: "心肺运动试验", keywords: ["CPET", "运动血氧"] },
  { name: "甲状腺功能", keywords: ["TSH", "甲状腺"] },
];

export const diagnosisLibrary: SearchLibraryItem[] = [
  { name: "急性失代偿性心力衰竭", keywords: ["心衰", "心功能不全", "肺水肿"] },
  { name: "间质性肺病", keywords: ["ILD", "肺间质"] },
  { name: "慢性阻塞性肺疾病IV级", keywords: ["COPD", "慢阻肺", "慢性阻塞性肺疾病"] },
  { name: "哮喘", keywords: ["支气管哮喘"] },
  { name: "冠心病", keywords: ["心肌梗死", "CAD"] },
];

export const blankDiagnosis = (id: string): DiagnosisEntry => ({
  id,
  name: "",
  support: "",
  isPrimary: false,
});

export const caseFixture = {
  id: "CASE-HF-2025-001",
  title: "反复咳嗽、呼吸困难：心力衰竭",
  subject: "内科",
  tertiaryDiscipline: "心血管内科",
  patient: "郭曼",
  profile: "女性，58 岁",
  complaint: "反复咳嗽伴呼吸困难 4 年，加重 3 个月",
  vitals: "T 36.6℃ · P 97次/分 · R 20次/分 · BP 111/79mmHg · SpO₂ 90%",
};

export const defaultPatientProfile: PatientProfile = {
  name: "郭曼",
  gender: "女",
  age: 58,
  occupation: "考古学教授",
  maritalStatus: "已婚 35 年",
  chiefComplaint: "反复咳嗽伴呼吸困难 4 年，加重 3 个月。",
  presentIllness:
    "4 年前起间歇咳嗽、劳力性呼吸困难；近 3 个月持续咳嗽、白色或透明痰、平地行走即气短、夜间平卧加重，伴双踝水肿、乏力与食欲下降。",
  pastHistory: "5 年前心肌梗死并置入冠脉支架；合并冠心病、高血压、高脂血症、2 型糖尿病及慢性肾病；近 2 年未规律复诊。",
  personalHistory: "既往吸烟约 20 年、每日半包，40 多岁戒烟；不饮酒。",
  familyHistory: "父亲 70 岁因肺癌去世，母亲 65 岁因心脏病去世；父母均有高血压和糖尿病。",
  allergyHistory: "磺胺类药物过敏。",
  physicalExam:
    "颈静脉怒张、肝颈静脉回流征阳性、双肺底湿啰音、心尖部 2/6 级收缩期杂音及双踝凹陷性水肿。",
  auxiliaryExam: "NT-proBNP 1020 pg/ml；PaO₂ 59 mmHg；胸片提示肺淤血及双侧胸腔积液。",
  appearanceDescription:
    "58 岁中国女性，半卧于内科病房床位，神志清楚，活动后略感气短，形象自然可信。",
  avatarStatus: "ready",
  voiceId: "female-middle",
};

export const conversationScript = heartFailureDialogue;

export const physicalResults = Object.entries(physicalFindings);
export const labRows = Object.values(laboratoryResults).flat();

export const emptyAttempt = (examId: string): Attempt => ({
  id: "ATTEMPT-DEMO-001",
  examId,
  status: "not_started",
  currentStage: 1,
  completedStages: [],
  transcript: [],
  physicalItems: [{ id: "p1", label: "", interpretation: "" }],
  physicalRevealed: false,
  auxiliaryItems: [{ id: "a1", label: "", interpretation: "" }],
  auxiliaryRevealed: false,
  historyNotes: {
    chiefComplaint: "",
    presentIllness: "",
    pastHistory: "",
    personalHistory: "",
    familyHistory: "",
    other: "",
  },
  historyDiagnoses: [blankDiagnosis("history-1")],
  physicalDiagnoses: [blankDiagnosis("physical-1")],
  finalDiagnoses: [blankDiagnosis("final-1")],
  plan: "",
  treatment: "",
  casePresentation: "",
  draft: "",
});

export const initialState: DemoState = {
  role: "teacher",
  exam: null,
  attempt: null,
};
