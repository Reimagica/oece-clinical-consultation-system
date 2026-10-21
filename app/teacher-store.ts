import {
  caseFixture,
  defaultPatientProfile,
  defaultExamPolicy,
  type Exam,
  type Attempt,
} from "./demo-data";
import {
  parseDetails,
  seedDetails,
  seedReferences,
  upgradeCase,
  patientSummary,
  type CaseDetails,
} from "./teacher-case-schema";
import {
  physicalFindings,
  laboratoryResults,
  testReports,
} from "./case-checks";
import {
  defaultPatientMedia,
  normalizePatientMedia,
  type PatientMedia,
} from "./teacher-patient-media";
import { HISTORY_RUBRIC_VERSION } from "./heart-failure-rubric";

export type CaseCheck = {
  resultFormat?: "text" | "markdown" | "image";
  resultImages?: CaseImage[];
  kind?: string;
  interpretation?: string;
  name: string;
  result: string;
  unit?: string;
  reference?: string;
  value?: number;
  low?: number;
  high?: number;
};
export type CaseReference = {
  title: string;
  maximum: number | null;
  items: {
    label: string;
    answer: string;
    points: number;
    group?: string;
    scoringNotes?: string;
    evidenceRequirement?: string;
  }[];
};
export type CaseImage = { name: string; src: string; usage?: string };
export type TeachingCase = {
  media?: PatientMedia;
  id: string;
  name: string;
  department: string;
  difficulty: string;
  patient: string;
  overview: string;
  history: string;
  checks: CaseCheck[];
  references: CaseReference[];
  images: CaseImage[];
  builtin: boolean;
  historyRubricVersion?: string;
  schemaVersion?: 2;
  caseCode?: string;
  details?: CaseDetails;
  sourceName?: string;
  sourceText?: string;
};
export type ExamDraft = {
  id: string;
  title: string;
  caseId: string;
  policy: Exam["policy"];
  updatedAt: string;
};
export type ExamArchive = {
  id: string;
  exam: Exam;
  attempt: Attempt | null;
  archivedAt: string;
};
export type TeacherStore = {
  version: 1;
  cases: TeachingCase[];
  drafts: ExamDraft[];
  archives: ExamArchive[];
};
export const TEACHER_KEY = "aimed-teacher-demo-v2";

const referenceExam: Exam = {
  id: "reference",
  title: "",
  description: "",
  durationMinutes: 30,
  caseId: caseFixture.id,
  caseName: caseFixture.title,
  studentId: "",
  studentName: "",
  status: "published",
  publishedAt: "",
  policy: defaultExamPolicy,
  patientProfile: defaultPatientProfile,
};
export function seedCase(): TeachingCase {
  const lab = (
    panel: string,
    name: string,
    low?: number,
    high?: number,
  ): CaseCheck => {
    const row = laboratoryResults[panel].find((item) => item[0] === name)!;
    return {
      name,
      result: row[1],
      unit: row[2],
      reference: row[3],
      value: Number(row[1]),
      low,
      high,
    };
  };
  return {
    id: caseFixture.id,
    name: "反复咳嗽与呼吸困难",
    department: caseFixture.tertiaryDiscipline,
    difficulty: "中等",
    patient: "郭曼 · 女 · 58岁",
    builtin: true,
    historyRubricVersion: HISTORY_RUBRIC_VERSION,
    media: defaultPatientMedia(true),
    schemaVersion: 2,
    caseCode: caseFixture.id,
    details: seedDetails(),
    overview: defaultPatientProfile.chiefComplaint,
    history: `现病史：${defaultPatientProfile.presentIllness}\n\n既往史：${defaultPatientProfile.pastHistory}\n\n个人史：${defaultPatientProfile.personalHistory}\n\n家族史：${defaultPatientProfile.familyHistory}\n\n过敏史：${defaultPatientProfile.allergyHistory}`,
    checks: [
      lab("NT-proBNP", "NT-proBNP", 0, 125),
      lab("动脉血气分析", "PaO₂", 90, 100),
      lab("血生化", "肌酐", 0.59, 1.4),
      { name: "心脏听诊", result: physicalFindings["心脏听诊"] },
      { name: "双肺听诊", result: physicalFindings["双肺听诊"] },
      { name: "颈静脉检查", result: physicalFindings["颈静脉怒张检查"] },
      { name: "胸部X线", result: testReports["胸部X线"] },
    ],
    references: seedReferences(),
    images: [],
    sourceName: "25练习一 心衰 病例信息及评分标准.docx",
  };
}
export function initialTeacherStore(): TeacherStore {
  return { version: 1, cases: [seedCase()], drafts: [], archives: [] };
}
export function blankCase(): TeachingCase {
  return {
    id: crypto.randomUUID(),
    name: "",
    department: "",
    difficulty: "中等",
    patient: "",
    overview: "",
    history: "",
    checks: [],
    references: [],
    images: [],
    builtin: false,
    media: defaultPatientMedia(),
    schemaVersion: 2,
    details: parseDetails(null),
  };
}

const text = (value: unknown, limit = 50000) =>
  typeof value === "string" ? value.slice(0, limit) : "";
export function importedCase(input: unknown, filename: string): TeachingCase {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("JSON需包含一份病例对象，可先下载病例模板。");
  const value = input as Record<string, unknown>;
  if (value.documentType === "scoring-standard")
    throw new Error(
      "这是评分标准文件，请先打开对应病例，在编辑页的评分标准中导入。",
    );
  const result = blankCase();
  result.media = normalizePatientMedia(value.media);
  result.name = text(value.name, 120);
  result.department = text(value.department, 80);
  result.patient = text(value.patient, 160);
  result.caseCode = text(value.caseCode, 120);
  result.details = parseDetails(value.details);
  result.patient = patientSummary(result.details, result.patient);
  result.difficulty = ["基础", "中等", "进阶"].includes(
    String(value.difficulty),
  )
    ? String(value.difficulty)
    : "中等";
  result.overview = text(value.overview);
  result.history = text(value.history);
  if (result.history && !value.details)
    result.details.medicalHistory.otherHistory = result.history;
  result.sourceName = text(value.sourceName, 500) || filename;
  result.sourceText = text(value.sourceText, 100000);
  if (Array.isArray(value.checks))
    result.checks = value.checks.slice(0, 40).map((raw) => {
      if (!raw || typeof raw !== "object")
        throw new Error("检查资料格式不正确，请使用模板。");
      const row = raw as Record<string, unknown>;
      const numeric = Number(row.result);
      const low =
        typeof row.low === "number" && Number.isFinite(row.low) && row.low >= 0
          ? row.low
          : undefined;
      const high =
        typeof row.high === "number" &&
        Number.isFinite(row.high) &&
        row.high > (low ?? 0)
          ? row.high
          : undefined;
      return {
        resultFormat:
          row.resultFormat === "markdown" || row.resultFormat === "image"
            ? row.resultFormat
            : "text",
        resultImages: parseImages(row.resultImages),
        kind: text(row.kind, 80),
        interpretation: text(row.interpretation, 5000),
        name: text(row.name, 120),
        result: text(row.result, 5000),
        unit: text(row.unit, 80),
        reference: text(row.reference, 120),
        ...(high !== undefined && Number.isFinite(numeric) && numeric >= 0
          ? { value: numeric, low, high }
          : {}),
      };
    });
  if (Array.isArray(value.references))
    result.references = parseReferences(value.references);
  result.images = parseImages(value.images);
  return result;
}

function parseImages(value: unknown): CaseImage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const image = raw as Record<string, unknown>;
    return typeof image.src === "string" &&
      /^data:image\/(png|jpeg|webp);base64,/.test(image.src) &&
      image.src.length < 1400000
      ? [
          {
            name: text(image.name, 120),
            src: image.src,
            usage: text(image.usage, 500),
          },
        ]
      : [];
  });
}

export function parseReferences(input: unknown): CaseReference[] {
  if (!Array.isArray(input) || input.length > 12)
    throw new Error("评分文件需包含references数组，最多12个维度。");
  return input.map((raw) => {
    if (!raw || typeof raw !== "object")
      throw new Error("评价维度格式不正确，请使用模板。");
    const row = raw as Record<string, unknown>;
    const items = Array.isArray(row.items)
      ? row.items.slice(0, 100).map((item) => {
          if (!item || typeof item !== "object")
            throw new Error("参考答案格式不正确。");
          const entry = item as Record<string, unknown>;
          return {
            label: text(entry.label, 160),
            answer: text(entry.answer, 5000),
            group: text(entry.group, 120),
            scoringNotes: text(entry.scoringNotes, 5000),
            evidenceRequirement: text(entry.evidenceRequirement, 5000),
            points:
              typeof entry.points === "number" &&
              entry.points >= 0 &&
              entry.points <= 1000 &&
              Number.isFinite(entry.points)
                ? entry.points
                : (() => {
                    throw new Error("分值需为0至1000的数字。");
                  })(),
          };
        })
      : [];
    return {
      title: text(row.title, 120),
      maximum:
        row.maximum === null ? null : items.reduce((n, i) => n + i.points, 0),
      items,
    };
  });
}

export async function readScoringFile(file: File) {
  if (!/\.json$/i.test(file.name) || file.size > 4 * 1024 * 1024)
    throw new Error("请使用4MB以内的评分标准JSON文件。");
  let raw;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error("评分文件JSON格式不正确。");
  }
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.references))
    throw new Error("评分文件缺少references维度数组。");
  return {
    caseCode: text(raw.caseCode, 120),
    references: parseReferences(raw.references),
  };
}

export function readTeacherStore(raw: string | null): TeacherStore {
  if (!raw) return initialTeacherStore();
  const data = JSON.parse(raw) as TeacherStore;
  if (
    data.version !== 1 ||
    !Array.isArray(data.cases) ||
    !Array.isArray(data.drafts) ||
    !Array.isArray(data.archives)
  )
    throw new Error(
      "教师资料读取失败，已保留原记录。请先导出备份或检查浏览器存储。",
    );
  for (const c of data.cases)
    if (
      !c ||
      typeof c.id !== "string" ||
      typeof c.name !== "string" ||
      !Array.isArray(c.checks) ||
      !Array.isArray(c.references) ||
      !Array.isArray(c.images)
    )
      throw new Error("病例记录不完整，已停止覆盖原记录。");
  if (
    data.cases.filter((c) => c.builtin).length !== 1 ||
    !data.cases.some((c) => c.builtin && c.id === caseFixture.id)
  )
    throw new Error("内置病例记录不完整，已停止覆盖原记录。");
  for (const d of data.drafts)
    if (
      !d ||
      typeof d.id !== "string" ||
      typeof d.title !== "string" ||
      d.caseId !== caseFixture.id ||
      !d.policy ||
      typeof d.updatedAt !== "string"
    )
      throw new Error("考试草稿记录不完整，已保留原记录。");
  for (const a of data.archives)
    if (
      !a ||
      typeof a.id !== "string" ||
      !a.exam ||
      typeof a.exam.id !== "string" ||
      typeof a.archivedAt !== "string"
    )
      throw new Error("考试归档记录不完整，已保留原记录。");
  return { ...data, cases: data.cases.map(upgradeCase) };
}

export async function readCaseFile(file: File): Promise<TeachingCase> {
  if (file.size > 4 * 1024 * 1024) throw new Error("请使用4MB以内的病例资料。");
  if (/\.json$/i.test(file.name)) {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw new Error("JSON格式不正确，请使用病例模板或检查文件内容。");
    }
    return importedCase(data, file.name);
  }
  let body: string;
  if (/\.docx$/i.test(file.name)) {
    const { unzipSync, strFromU8 } = await import("fflate");
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (info) => {
          if (info.name !== "word/document.xml") return false;
          if (info.originalSize > 2 * 1024 * 1024)
            throw new Error("文档正文过长，请精简后再上传。");
          return true;
        },
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes("正文过长")) throw e;
      throw new Error(
        "Word文件无法读取，请确认文件未损坏，或另存为.docx后重试。",
      );
    }
    if (!files["word/document.xml"])
      throw new Error("未找到Word正文，请使用.docx文件。");
    const xml = new DOMParser().parseFromString(
      strFromU8(files["word/document.xml"]),
      "text/xml",
    );
    if (xml.querySelector("parsererror"))
      throw new Error("Word正文解析失败，请另存为新的.docx后重试。");
    body = Array.from(xml.getElementsByTagNameNS("*", "p"))
      .map((p) =>
        Array.from(p.getElementsByTagNameNS("*", "t"))
          .map((t) => t.textContent)
          .join(""),
      )
      .filter(Boolean)
      .join("\n");
  } else if (/\.(txt|md)$/i.test(file.name)) body = await file.text();
  else throw new Error("支持Word（.docx）、TXT、Markdown和JSON病例模板。");
  if (!body.trim()) throw new Error("文件中没有可读取的正文。");
  if (body.length > 100000) throw new Error("正文过长，请精简到10万字以内。");
  const record = blankCase();
  record.name = file.name.replace(/\.[^.]+$/, "").slice(0, 120);
  record.sourceName = file.name;
  record.sourceText = body;
  const field = (labels: string) =>
    body
      .match(new RegExp(`(?:^|\\n)\\s*(?:${labels})[：:]\\s*([^\\n]+)`))?.[1]
      ?.trim() ?? "";
  record.department = field("科室|学科");
  record.patient = field("患者|患者信息|基本信息");
  record.overview = field("主诉|病例概况|概况");
  record.history = body;
  record.details = parseDetails(null);
  record.details.medicalHistory.otherHistory = body;
  const sections = [
    ["patientInfo", "name", "姓名"],
    ["patientInfo", "gender", "性别"],
    ["patientInfo", "age", "年龄"],
    ["patientInfo", "occupation", "职业"],
    ["patientInfo", "maritalStatus", "婚育情况|婚姻状况"],
    ["medicalHistory", "presentIllness", "现病史"],
    ["medicalHistory", "pastHistory", "既往史"],
    ["medicalHistory", "medicationHistory", "用药史"],
    ["medicalHistory", "allergyHistory", "过敏史"],
    ["medicalHistory", "personalHistory", "个人史"],
    ["medicalHistory", "familyHistory", "家族史"],
    ["context", "setting", "就诊场景"],
    ["context", "objectives", "教学目标"],
  ] as const;
  for (const [section, key, labels] of sections)
    record.details[section][key] = field(labels);
  if (sections.some(([section, key]) => record.details![section][key]))
    record.details.medicalHistory.otherHistory = field("其他病历资料|其他资料");
  record.patient = patientSummary(record.details, record.patient);
  return record;
}

export function draftToExam(draft: ExamDraft): Exam {
  if (draft.caseId !== caseFixture.id)
    throw new Error("该病例仅供教师展示，尚未接入学生端考试。");
  return {
    ...referenceExam,
    id: draft.id,
    title: draft.title,
    description: "完成病史、体查、辅检与诊疗汇报。",
    caseName: caseFixture.title,
    studentId: "shanyi-ai-2025-flora-beijing-medical-001",
    studentName: "编号 001 学员",
    publishedAt: new Date().toISOString(),
    policy: draft.policy,
  };
}
export function newDraft(): ExamDraft {
  return {
    id: `EXAM-${crypto.randomUUID()}`,
    title: "心力衰竭病例练习",
    caseId: caseFixture.id,
    policy: { ...defaultExamPolicy },
    updatedAt: new Date().toISOString(),
  };
}
