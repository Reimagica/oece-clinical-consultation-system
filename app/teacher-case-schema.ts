import { buildDimensions } from "./assessment";
import {
  defaultPatientProfile,
  caseFixture,
  defaultExamPolicy,
  emptyAttempt,
  type Exam,
} from "./demo-data";
import { historyRubric, HISTORY_RUBRIC_VERSION } from "./heart-failure-rubric";
import type { TeachingCase, CaseReference } from "./teacher-store";
import {
  defaultPatientMedia,
  normalizePatientMedia,
} from "./teacher-patient-media";

export const caseFieldGroups = [
  {
    key: "patientInfo",
    title: "患者基本信息",
    fields: [
      ["name", "姓名"],
      ["gender", "性别"],
      ["age", "年龄"],
      ["occupation", "职业"],
      ["maritalStatus", "婚育情况"],
      ["residence", "居住情况"],
      ["informationSource", "病史陈述者与可靠性"],
    ],
  },
  {
    key: "medicalHistory",
    title: "病史资料",
    fields: [
      ["presentIllness", "现病史"],
      ["pastHistory", "既往史"],
      ["medicationHistory", "用药史"],
      ["allergyHistory", "过敏史"],
      ["personalHistory", "个人史"],
      ["familyHistory", "家族史"],
      ["reproductiveHistory", "月经与生育史"],
      ["reviewOfSystems", "系统回顾"],
      ["otherHistory", "其他病历资料"],
    ],
  },
  {
    key: "context",
    title: "教学与就诊场景",
    fields: [
      ["setting", "就诊场景"],
      ["targetLearners", "适用学员"],
      ["objectives", "教学目标"],
      ["tasks", "学员任务"],
      ["keyPoints", "教学重点"],
      ["limitations", "资料局限与待核验项"],
    ],
  },
  {
    key: "clinicalReference",
    title: "诊断与诊疗要点",
    fields: [
      ["initialDiagnosis", "初步诊断参考"],
      ["revisedDiagnosis", "诊断修正参考"],
      ["finalDiagnosis", "最终诊断参考"],
      ["diagnosticEvidence", "诊断依据"],
      ["differentialDiagnosis", "鉴别诊断"],
      ["investigationPlan", "进一步检查计划"],
      ["treatmentPlan", "治疗与随访原则"],
    ],
  },
] as const;
export type CaseSection = (typeof caseFieldGroups)[number]["key"];
export type CaseDetails = Record<CaseSection, Record<string, string>>;
export function blankDetails(): CaseDetails {
  return Object.fromEntries(
    caseFieldGroups.map((g) => [
      g.key,
      Object.fromEntries(g.fields.map(([key]) => [key, ""])),
    ]),
  ) as CaseDetails;
}
export function parseDetails(raw: unknown): CaseDetails {
  const result = blankDetails();
  if (!raw || typeof raw !== "object") return result;
  for (const group of caseFieldGroups) {
    const source = (raw as Record<string, unknown>)[group.key];
    if (!source || typeof source !== "object") continue;
    for (const [key] of group.fields) {
      const value = (source as Record<string, unknown>)[key];
      if (typeof value === "string")
        result[group.key][key] = value.slice(0, 50000);
    }
  }
  return result;
}
export function seedDetails(): CaseDetails {
  const d = blankDetails(),
    p = defaultPatientProfile;
  d.patientInfo = {
    ...d.patientInfo,
    name: p.name,
    gender: p.gender,
    age: String(p.age),
    occupation: p.occupation,
    maritalStatus: p.maritalStatus,
  };
  for (const key of [
    "presentIllness",
    "pastHistory",
    "personalHistory",
    "familyHistory",
    "allergyHistory",
  ] as const)
    d.medicalHistory[key] = p[key];
  d.context.setting = "内科病房";
  d.context.targetLearners = "大五临床轮转医学生";
  d.context.objectives = "病史信息采集；检查选择与诊断修正；诊疗依据与计划。";
  d.context.limitations = "参考资料与评价规则待医学复核。";
  d.clinicalReference.finalDiagnosis = "急性失代偿性心力衰竭";
  return d;
}

// Presentation-only conversion. The student scoring engine and source rubric stay unchanged.
export function seedReferences(): CaseReference[] {
  const summaryLabels = [
    "年龄与性别",
    "基础疾病",
    "咳嗽病程",
    "症状变化",
    "呼吸困难特点",
    "氧合情况",
    "心室容量负荷",
    "杂音特征",
    "生化指标",
    "影像表现",
  ];
  const evidenceLabels = [
    "静脉充血体征",
    "肺部听诊",
    "心衰标志物",
    "肝功能",
    "肺淤血影像",
    "胸腔积液影像",
    "运动与氧合",
    "心脏听诊",
  ];
  const historyLabels: Record<number, string> = {
    22: "伴随症状与阴性症状",
    23: "关节不适",
    24: "腰背部不适",
    26: "食欲",
    27: "体重",
    28: "排尿",
    29: "心血管病史与手术史",
    30: "哮喘病史",
    31: "其他既往疾病",
    32: "复诊情况",
    33: "药物过敏",
    34: "吸烟史",
    35: "运动情况",
    36: "绝经情况",
    37: "父母慢性病史",
    38: "父亲疾病史",
    39: "母亲疾病史",
    40: "结束问诊",
  };
  const exam: Exam = {
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
  return buildDimensions(exam, emptyAttempt("reference")).map((d) => ({
    title: d.title,
    maximum: d.maximum,
    items: d.items.flatMap((i, index) => {
      if (i.breakdown)
        return i.breakdown.map((part) => ({
          label: `${i.label} · ${part.label}`,
          points: part.maximum,
          answer:
            part.label === "顺序"
              ? d.id === "stage"
                ? i.reference
                : `选择${i.label}，并排列在项目分更高的检查之后；同分项目不分先后。`
              : i.reference,
          group: i.group,
        }));
      const colon = i.reference.search(/[：:]/);
      let label =
        colon > 0
          ? i.reference.slice(0, colon)
          : `${d.id === "history" ? historyRubric[index]?.section || "问诊" : i.group || d.title} · 要点${index + 1}`;
      if (colon < 0 && d.id === "history")
        label = historyLabels[index] || label;
      if (d.id === "final" && index < 10)
        label = `病例汇报 · ${summaryLabels[index]}`;
      if (d.id === "final" && index > 10)
        label = `诊断依据 · ${evidenceLabels[index - 11]}`;
      if (d.id === "treatment" && colon < 0)
        label = [
          "一般治疗",
          "利尿治疗",
          "改善心肌代谢",
          "β受体阻滞剂治疗",
          "ACEI/ARB/ARNI治疗",
        ][index];
      return [
        {
          label: i.label === "最终诊断" ? i.label : label,
          answer: colon > 0 ? i.reference.slice(colon + 1).trim() : i.reference,
          points: i.maximum,
          group: i.group,
        },
      ];
    }),
  }));
}
function upgradeHistoryReference(record: TeachingCase): TeachingCase {
  if (!record.builtin || record.id !== caseFixture.id || record.historyRubricVersion)
    return record;
  const current = seedReferences()[0];
  // Only the untouched 72-point seed is eligible. Preserve teacher-authored rules,
  // answers, notes, other dimensions and patient data; never migrate copied cases.
  const increased = new Set([10, 11, 12, 13, 25, 28, 30, 31, 32, 37]);
  const decreased = new Set([23, 24]);
  const references = record.references.map((reference) => {
    const isLegacySeed = reference.title === current.title && reference.maximum === 72 &&
      reference.items.length === current.items.length && reference.items.every((item, i) => {
        const expected = current.items[i];
        const oldPoints = increased.has(i) ? 1 : decreased.has(i) ? 2 : expected.points;
        return item.label === expected.label && item.answer === expected.answer &&
          item.group === expected.group && item.points === oldPoints &&
          !item.scoringNotes && !item.evidenceRequirement;
      });
    return isLegacySeed ? { ...reference, maximum: current.maximum,
      items: reference.items.map((item, i) => ({ ...item, points: current.items[i].points })) } : reference;
  });
  return { ...record, historyRubricVersion: HISTORY_RUBRIC_VERSION, references };
}
export function upgradeCase(record: TeachingCase): TeachingCase {
  const media = normalizePatientMedia(record.media, record.builtin);
  if (record.schemaVersion === 2) return upgradeHistoryReference({ ...record, media });
  const details = record.builtin ? seedDetails() : blankDetails();
  if (!record.builtin)
    details.medicalHistory.otherHistory = record.history || "";
  return {
    ...record,
    media,
    schemaVersion: 2,
    historyRubricVersion: record.builtin ? HISTORY_RUBRIC_VERSION : undefined,
    details,
    references: record.builtin ? seedReferences() : record.references,
  };
}
export function patientSummary(details: CaseDetails, fallback: string) {
  const p = details.patientInfo;
  return (
    [p.name, p.gender, p.age && `${p.age}岁`].filter(Boolean).join(" · ") ||
    fallback
  );
}
export function historyText(details: CaseDetails) {
  return caseFieldGroups[1].fields
    .filter(([key]) => details.medicalHistory[key])
    .map(([key, label]) => `${label}：${details.medicalHistory[key]}`)
    .join("\n\n");
}
export function patientTemplate() {
  return {
    documentType: "patient-case",
    schemaVersion: 2,
    caseCode: "病例编号（与评分文件一致）",
    name: "",
    department: "",
    difficulty: "中等",
    patient: "",
    overview: "",
    details: blankDetails(),
    media: defaultPatientMedia(),
    checks: [
      {
        kind: "体格检查",
        name: "",
        result: "",
        resultFormat: "text",
        resultImages: [],
        unit: "",
        reference: "",
        interpretation: "",
        low: null,
        high: null,
      },
    ],
    images: [],
    sourceName: "",
    sourceText: "",
    _填写说明:
      "name病例名称、department科室、overview主诉必填；患者简述可由details.patientInfo生成。未知信息留空，勿编造。checks可多行，low/high仅用于数值参考范围图；图片在编辑页上传。评分标准另用评分模板，上传患者资料后在编辑页导入评分。",
  };
}
export function scoringTemplate(caseCode = "病例编号（与患者文件一致）") {
  return {
    documentType: "scoring-standard",
    schemaVersion: 2,
    caseCode,
    references: seedReferences().map((r) => ({
      title: r.title,
      maximum: r.maximum === null ? null : 0,
      items: [
        {
          label: "",
          answer: "",
          points: 0,
          group: "",
          scoringNotes: "",
          evidenceRequirement: "",
        },
      ],
    })),
    _填写说明:
      "每行填写小分项目label、参考答案answer、分值points；group为分组，scoringNotes为给分/部分分规则，evidenceRequirement为证据要求。维度总分自动求和；maximum设null为描述性评价。导入后预览确认再保存；不会自动改动学生Demo判分。",
  };
}
