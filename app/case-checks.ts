// Transcribed from the approved source Word. Conflicts remain explicit.
export const CASE_VERSION = "hf-2025-20260924";
export const RULE_VERSION = "hf-review-20261016";
export const caseConflicts = [
  "阶段一哮喘／COPD标准不同，等待医学确认。",
  "诊断依据正文与表格分值不同，暂沿用表格满分，具体判分待复核。",
  "原资料BUN／肌酐比值42与所列数值不一致，该比值暂不展示。",
  "原资料A/G比值1.8与白蛋白3.9、球蛋白3.2不一致，保留原记录并待核验。",
];
const aliases: Record<string, string[]> = {
  "心脏听诊": ["心音听诊", "心脏听诊"], "双肺听诊": ["肺部听诊", "双肺听诊", "胸部听诊"],
  "颈静脉怒张检查": ["颈静脉充盈情况", "颈静脉检查", "颈静脉怒张检查", "JVP"],
  "肝颈静脉回流征": ["肝颈静脉回流征检查", "肝颈静脉回流征"],
  "下肢水肿检查": ["下肢水肿检查", "踝部水肿检查"], "腹部视诊": ["腹部视诊", "腹壁视诊"],
  "NT-proBNP": ["NT-proBNP", "NTproBNP", "心功能检查"],
  "胸部X线": ["胸片", "胸部X线", "胸部X片", "胸部X光", "Xray"],
  "动脉血气分析": ["血气分析", "动脉血气分析", "血气"], "心电图": ["心电图", "ECG", "EKG", "十二导联心电图"],
  "血生化": ["生化", "血生化", "肾功能", "电解质"], "血常规": ["血常规"],
  "肝功能": ["肝功能", "肝功能检查"], "心肺运动试验": ["心肺运动试验", "心肺功能运动试验", "CPET"],
  "甲状腺功能": ["甲状腺功能", "甲功", "TSH"], "生命体征": ["生命体征", "一般情况"],
};
export const normalizeCheck = (text: string) => text.toLowerCase().replace(/[\s·、，,（）()：:\-]/g, "");
export function canonicalCheck(text: string) {
  const entry = Object.entries(aliases).find(([, names]) => names.some(name => normalizeCheck(name) === normalizeCheck(text)));
  return entry?.[0] ?? text.trim();
}
export function duplicateChecks(items: { label: string }[]) {
  const names = items.filter(x => x.label.trim()).map(x => normalizeCheck(canonicalCheck(x.label)));
  return names.length !== new Set(names).size;
}
export const physicalFindings: Record<string, string> = {
  "生命体征": "T 36.6℃，BP 111/79 mmHg，P 97次/分，R 20次/分，SpO₂ 90%，身高1.6m，BMI 31。",
  "心脏听诊": "心尖部可闻及2/6级收缩期杂音，S2后可闻及额外心音。",
  "双肺听诊": "双侧肺部底部呼吸音减弱，双下肺可闻及粗湿啰音。",
  "颈静脉怒张检查": "半卧位（床头抬高45°），可见颈静脉充盈至胸骨角上方6cm。",
  "肝颈静脉回流征": "对腹部（肝脏上方）施加压力10秒后松开，静脉压持续维持在高于胸骨角9cm的位置。",
  "下肢水肿检查": "踝部双侧凹陷性水肿，有袜口凹陷痕迹。",
  "腹部视诊": "右上腹可见约10cm长手术瘢痕。",
};
export const laboratoryResults: Record<string, string[][]> = {
  "NT-proBNP": [["NT-proBNP", "1020", "pg/ml", "<125"], ["hs-肌钙蛋白", "13", "ng/L", "<14"]],
  "血生化": [["钠","142","mEq/L","135–145"],["钾","3.9","mEq/L","3.6–5.2"],["氯","101","mEq/L","96–106"],["碳酸氢盐","28","mEq/L","22–30"],["血尿素氮","18","mg/dL","6–24"],["肌酐","1.8","mg/dL","0.59–1.4"],["葡萄糖","111","mg/dL","80–120"],["糖化血红蛋白","7.5","%","4–5.6"],["阴离子间隙","12","mEq/L","6–12"],["BUN／肌酐比值","待核验","","原资料数值不一致"]],
  "动脉血气分析": [["PaCO₂","43","mmHg","35–45"],["PaO₂","59","mmHg","90–100"],["pH","7.38","","7.35–7.45"]],
  "肝功能": [["AST","50","U/L","8–33"],["ALT","51","U/L","4–36"],["碱性磷酸酶","124","IU/L","44–147"],["总胆红素","1.2","mg/dL","0.2–1.2"],["直接胆红素","0.1","mg/dL","0.1–0.3"],["白蛋白","3.9","g/dL","3.5–5.5"],["球蛋白","3.2","g/dL","1.8–3.8"],["A/G比值","1.8","","1.5–2.5"],["γ-谷氨酰转移酶","25","U/L","5–40"]],
  "血常规": [["白细胞","9","K/μL","4–11"],["血红蛋白","14.9","g/dL","11.9–17.5"],["血细胞比容","45","%","35–50"],["平均红细胞体积","84","fL","80–100"],["血小板","198","K/μL","150–450"]],
  "甲状腺功能": [["TSH","2.3","mU/L","0.4–5.0"]],
};
export const testReports: Record<string, string> = {
  "心电图": "窦性心律，97次/分，V5–V6导联可见R波最高，V5、V6、I和aVL导联的T波变平。",
  "胸部X线": "心脏轮廓增大，肺可见明显血管结构和间质标记，支气管纹理增多及增厚，纵隔未发现异常，少量双侧胸腔积液。",
  "心肺运动试验": "静息室内空气SpO₂ 90%，静息吸氧96%；室内空气行走83%，行走吸氧96%。",
};
export function checkResultText(name: string) {
  const key = canonicalCheck(name);
  return physicalFindings[key] ?? testReports[key] ?? laboratoryResults[key]?.map(row => row.join(" · ")).join("\n") ?? "未配置该项目结果";
}
