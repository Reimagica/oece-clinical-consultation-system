"use client";
/* eslint-disable @next/next/no-img-element */

import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
import { duplicateChecks } from "./case-checks";
import LivePatientChat from "./live-patient-chat";
import PatientMedia, { PatientMediaTools } from "./patient-media";
import { speakPatientText, stopPatientPlayback } from "./patient-playback";
import SequentialCheckTable from "./sequential-check-table";
import SpeechInput from "./speech-input";
import { fixedCheckResult } from "./check-results";
import { defaultDimensionWeights, normalizeWeights, scoringDimensions, type DimensionWeights } from "./score-policy";
import { restoreDemoState, updateActiveAttempt } from "./attempt-state";
import EvaluationReportView from "./evaluation-report";
import {
  Attempt,
  DemoState,
  DiagnosisEntry,
  Exam,
  PatientProfile,
  PatientVoiceId,
  SearchLibraryItem,
  blankDiagnosis,
  caseFixture,
  conversationScript,
  defaultPatientProfile,
  diagnosisLibrary,
  emptyAttempt,
  initialState,
  stages,
} from "./demo-data";

const STORAGE_KEY = "aimed-oece-heart-failure-v1";

const patientVoiceOptions: Array<{
  id: PatientVoiceId;
  name: string;
  detail: string;
  gender: "男声" | "女声";
  available: boolean;
  recommended?: boolean;
}> = [
  {
    id: "male-young",
    name: "青年男性",
    detail: "清朗 · 语速偏快",
    gender: "男声",
    available: false,
  },
  {
    id: "male-middle",
    name: "中年男性",
    detail: "沉稳 · 清晰自然",
    gender: "男声",
    available: false,
  },
  {
    id: "male-senior",
    name: "老年男性",
    detail: "低哑 · 语速较慢",
    gender: "男声",
    available: false,
  },
  {
    id: "female-young",
    name: "青年女性",
    detail: "清亮 · 语速自然",
    gender: "女声",
    available: false,
  },
  {
    id: "female-middle",
    name: "中年女性",
    detail: "中文女性声线 · 当前案例",
    gender: "女声",
    available: true,
    recommended: true,
  },
  {
    id: "female-senior",
    name: "老年女性",
    detail: "舒缓 · 语速较慢",
    gender: "女声",
    available: false,
  },
];

const voiceNameMap = Object.fromEntries(
  patientVoiceOptions.map((voice) => [voice.id, voice.name]),
) as Record<PatientVoiceId, string>;

const scriptedTurnTime = (turnIndex: number, patient = false) => {
  const pair = conversationScript[turnIndex];
  const sourceTime = pair && (patient ? pair.answeredAt : pair.askedAt);
  if (sourceTime && Number.isFinite(Number(sourceTime))) {
    return new Date(Number(sourceTime)).toLocaleTimeString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
  }
  return "--:--:--";
};

function completeDemoAttempt(attempt: Attempt): Attempt {
  const transcript = conversationScript.flatMap((pair, index) => [
    { id: `demo-student-${index}`, speaker: "student" as const, text: pair.student, time: scriptedTurnTime(index), stage: pair.stage, mode: "scripted" as const, sourceTurn: index + 1, sourceTime: pair.askedAt },
    { id: `demo-patient-${index}`, speaker: "patient" as const, text: pair.patient, time: scriptedTurnTime(index, true), stage: pair.stage, mode: "scripted" as const, sourceTurn: index + 1, sourceTime: pair.answeredAt },
  ]);
  const diagnoses = [
    { ...blankDiagnosis("demo-hf"), name: "急性失代偿性心力衰竭", isPrimary: true, support: diagnosisVoiceText("急性失代偿性心力衰竭") },
    { ...blankDiagnosis("demo-ild"), name: "间质性肺病", support: diagnosisVoiceText("间质性肺病") },
    { ...blankDiagnosis("demo-copd"), name: "慢性阻塞性肺疾病IV级", support: "慢性咳嗽与呼吸困难列入鉴别诊断。" },
  ];
  return {
    ...attempt,
    demoFilled: true,
    status: "submitted",
    startedAt: attempt.startedAt ?? new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    currentStage: 4,
    completedStages: [1, 2, 3, 4],
    transcript,
    historyDiagnoses: diagnoses.map((d) => ({ ...d })),
    physicalDiagnoses: diagnoses.map((d) => ({ ...d })),
    finalDiagnoses: diagnoses,
    physicalItems: [
      ["心脏听诊", "心尖部收缩期杂音及奔马律。"],
      ["双肺听诊", "双肺底湿啰音，提示肺淤血。"],
      ["颈静脉怒张检查", "颈静脉怒张，提示体循环淤血。"],
      ["肝颈静脉回流征", "回流征阳性。"],
      ["下肢水肿检查", "双踝凹陷性水肿。"],
    ].map(([label, interpretation], index) => ({ id: `demo-p-${index}`, label, interpretation, result: fixedCheckResult("physical", label), generatedAt: new Date().toISOString() })),
    physicalRevealed: true,
    auxiliaryItems: [
      ["NT-proBNP", "1020 pg/ml，显著升高。"],
      ["胸部X线", "肺淤血及双侧胸腔积液。"],
      ["动脉血气分析", "PaO₂ 59 mmHg，提示低氧血症。"],
      ["心电图", "左室高电压及侧壁导联 T 波低平。"],
      ["血生化", "肌酐及糖化血红蛋白升高。"],
    ].map(([label, interpretation], index) => ({ id: `demo-a-${index}`, label, interpretation, result: fixedCheckResult("auxiliary", label), generatedAt: new Date().toISOString() })),
    auxiliaryRevealed: true,
    casePresentation: "58岁女性，既往冠心病、心梗支架及高血压，反复咳嗽与劳力性呼吸困难4年，近3个月加重，伴低氧、夜间平卧加重及双踝水肿。查体颈静脉怒张、双肺底湿啰音，NT-proBNP升高，胸片提示肺淤血。考虑急性失代偿性心力衰竭。",
    plan: "监测生命体征、血氧、尿量和出入量，评估容量状态及肾功能。",
    treatment: "限制钠盐和水，氧疗、利尿剂；结合病情评估螺内酯、SGLT2抑制剂、β受体阻滞剂及ACEI/ARB/ARNI。",
  };
}

function usePath() {
  const [path, setPath] = useState("/demo");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPath(
      window.location.pathname === "/" ? "/demo" : window.location.pathname,
    );
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const go = (next: string) => {
    window.history.pushState({}, "", next);
    setPath(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return { path, go };
}

function formatTime(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function statusLabel(state: DemoState) {
  if (!state.exam) return "尚未创建";
  if (state.attempt?.status === "submitted") return "系统初评已生成";
  if (state.attempt?.status === "in_progress")
    return `进行中 · 第 ${state.attempt.currentStage} 阶段`;
  return "待开始";
}

export default function DemoApp() {
  const { path, go } = usePath();
  const [state, setState] = useState<DemoState>(() => initialState);
  const [hydrated, setHydrated] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [saveStatus, setSaveStatus] = useState("正在恢复本机记录…");

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          setState(restoreDemoState(raw));
        }
      } catch {
        setSaveStatus("本机记录读取失败，请勿关闭页面");
        setRestoreFailed(true);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!hydrated || restoreFailed) return;
    let message: string;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      message = "已保存到本机 · " + new Date().toLocaleTimeString("zh-CN");
    } catch {
      message = "保存失败，请勿刷新或关闭页面";
    }
    const timer = window.setTimeout(() => setSaveStatus(message), 0);
    return () => window.clearTimeout(timer);
  }, [state, hydrated, restoreFailed]);

  useEffect(() => {
    if (!saveStatus.includes("失败") && !saveStatus.startsWith("正在保存")) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveStatus]);

  const setRole = (role: "teacher" | "student") => {
    setState((previous) => ({ ...previous, role }));
    go(role === "teacher" ? "/teacher/exams" : "/student/tasks");
  };

  const publishExam = (exam: Exam) => {
    setState((previous) => ({
      ...previous,
      role: "teacher",
      exam,
      attempt: emptyAttempt(exam.id),
    }));
    go(`/teacher/exams/${exam.id}`);
  };

  const updateAttempt = (updater: (attempt: Attempt) => Attempt) => {
    if (!state.attempt || state.attempt.status === "submitted") return;
    setSaveStatus("正在保存到本机…");
    setState(previous => updateActiveAttempt(previous, updater));
  };

  const runDemoExam = () => {
    if (!state.attempt) return;
    const attemptId = state.attempt.id;
    updateAttempt(completeDemoAttempt);
    go(`/student/results/${attemptId}`);
  };

  const resetDemo = () => {
    if (!window.confirm("清除本机演示记录？此操作无法撤销。")) return;
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { setSaveStatus("无法清除本机存储"); return; }
    setState(initialState);
    go("/demo");
  };

  if (restoreFailed) return <div className="loading-screen"><h1>无法恢复本机记录</h1><p>已停止写入，原记录未覆盖。请保留当前浏览器数据，再检查存储权限或联系维护人员。</p></div>;

  if (!hydrated)
    return (
      <div className="loading-screen">
        <div className="pulse-logo">医</div>
        <p>正在进入 OECE 考核系统…</p>
      </div>
    );

  if (path === "/demo")
    return (
      <RoleLanding
        onRole={setRole}
        onReset={resetDemo}
        hasData={Boolean(state.exam)}
      />
    );
  if (path.startsWith("/student/exam/")) {
    return (
      <ExamWorkspace
        key={path}
        state={state}
        saveStatus={saveStatus}
        updateAttempt={updateAttempt}
        onDemoComplete={runDemoExam}
        go={go}
        onRole={setRole}
      />
    );
  }

  const role = path.startsWith("/student") ? "student" : "teacher";
  return (
    <PortalShell role={role} onRole={setRole} go={go} resetDemo={resetDemo}>
      {saveStatus.includes("失败") && <p role="alert" className="patient-live-error">{saveStatus} <button type="button" onClick={() => setState(previous => ({ ...previous }))}>重试保存</button></p>}
      {path === "/teacher/exams/new" && (
        <ExamWizard
          onPublish={publishExam}
          onCancel={() => go("/teacher/exams")}
        />
      )}
      {path.startsWith("/teacher/submissions/") && (
        <EvaluationReportView role="teacher" exam={state.exam} attempt={state.attempt} go={go} />
      )}
      {path.startsWith("/teacher/exams/") &&
        path !== "/teacher/exams/new" &&
        state.exam && <TeacherExamDetail state={state} go={go} />}
      {path === "/teacher/exams" && <TeacherDashboard state={state} go={go} />}
      {path === "/student/tasks" && <StudentTasks state={state} go={go} onDemoComplete={runDemoExam} />}
      {path.endsWith("/brief") && (
        <BriefPage state={state} go={go} updateAttempt={updateAttempt} />
      )}
      {path.startsWith("/student/results/") && (
        <EvaluationReportView role="student" exam={state.exam} attempt={state.attempt} go={go} />
      )}
    </PortalShell>
  );
}

function RoleLanding({
  onRole,
  onReset,
  hasData,
}: {
  onRole: (role: "teacher" | "student") => void;
  onReset: () => void;
  hasData: boolean;
}) {
  return (
    <main className="landing-page">
      <section className="landing-panel">
        <div className="landing-brand">
          <div className="logo-seal">医</div>
          <div>
            <strong>AIMED</strong>
            <span>AI MEDICAL EDUCATION</span>
          </div>
        </div>
        <div className="landing-copy">
          <span className="blue-kicker">AIMED 3.0 · OECE</span>
          <h1>
            让临床思维过程
            <br />
            <em>可观察、可回溯</em>
          </h1>
          <p>标准化临床考核，连接考试配置、过程作答与评估反馈。</p>
          <div className="flow-mini">
            {["病史采集", "体格检查", "辅助检查", "诊断与诊疗计划"].map(
              (item, index) => (
                <span key={item}>
                  <b>{index + 1}</b>
                  {item}
                </span>
              ),
            )}
          </div>
        </div>
        <div className="landing-foot">AIMED · 临床思维考核系统</div>
      </section>
      <section className="role-panel">
        <div className="role-panel-head">
          <p>系统入口</p>
          <h2>选择工作端</h2>
          <span>进入对应工作台继续考试流程。</span>
        </div>
        <button className="role-card teacher" onClick={() => onRole("teacher")}>
          <span className="role-icon">师</span>
          <div>
            <strong>教师端</strong>
            <small>创建考试 · 分配学员 · 查看提交</small>
          </div>
          <b>→</b>
        </button>
        <button className="role-card student" onClick={() => onRole("student")}>
          <span className="role-icon">生</span>
          <div>
            <strong>学员端</strong>
            <small>进入考试 · 完成四阶段 · 提交</small>
          </div>
          <b>→</b>
        </button>
        {hasData && (
          <button className="text-button reset-link" onClick={onReset}>
            ↻ 重置考试数据
          </button>
        )}
      </section>
    </main>
  );
}

function PortalShell({
  role,
  onRole,
  go,
  resetDemo,
  children,
}: {
  role: "teacher" | "student";
  onRole: (role: "teacher" | "student") => void;
  go: (path: string) => void;
  resetDemo: () => void;
  children: React.ReactNode;
}) {
  const teacher = role === "teacher";
  return (
    <main className="portal-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <aside className="side-nav">
        <button className="brand-mark" onClick={() => go("/demo")}>
          <span>医</span>
          <strong>AIMED</strong>
        </button>
        <div className="role-caption">
          {teacher ? "教师工作区" : "学员工作区"}
        </div>
        <nav>
          <button
            className="nav-item active"
            onClick={() => go(teacher ? "/teacher/exams" : "/student/tasks")}
          >
            ⌂ <span>{teacher ? "考试工作台" : "我的考试"}</span>
          </button>
          {teacher && (
            <button
              className="nav-item"
              onClick={() => go("/teacher/exams/new")}
            >
              ＋ <span>创建考试</span>
            </button>
          )}
          <button className="nav-item">
            ◇ <span>{teacher ? "病例库" : "历史记录"}</span>
          </button>
          <button className="nav-item">
            ◎ <span>评估与反馈</span>
            <i>七维</i>
          </button>
        </nav>
        <div className="side-note">
          <b>OECE</b>
          <span>临床思维考核</span>
        </div>
      </aside>
      <section className="portal-content">
        <header className="portal-topbar">
          <div className="breadcrumbs">
            AIMED 3.0 <span>/</span> {teacher ? "教师端" : "学员端"}
          </div>
          <div className="top-actions">
            <button className="ghost-button" onClick={resetDemo}>
              ↻ 重置数据
            </button>
            <div className="role-toggle">
              <button
                className={teacher ? "active" : ""}
                onClick={() => onRole("teacher")}
              >
                教师
              </button>
              <button
                className={!teacher ? "active" : ""}
                onClick={() => onRole("student")}
              >
                学员
              </button>
            </div>
            <span className="user-avatar">{teacher ? "师" : "生"}</span>
            <strong>{teacher ? "马老师" : "编号 001 学员"}</strong>
          </div>
        </header>
        <div className="page-content" id="main-content">
          {children}
        </div>
      </section>
    </main>
  );
}

function PageIntro({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {action}
    </div>
  );
}

function TeacherDashboard({
  state,
  go,
}: {
  state: DemoState;
  go: (path: string) => void;
}) {
  const status = statusLabel(state);
  return (
    <>
      <PageIntro
        kicker="EXAM CENTER"
        title="考试工作台"
        description="创建、发布并跟踪一场 OECE 临床思维考核。"
        action={
          <button
            className="primary-button"
            onClick={() => go("/teacher/exams/new")}
          >
            ＋ 新建考试
          </button>
        }
      />
      <section className="metric-grid">
        {[
          [
            "进行中",
            state.attempt?.status === "in_progress" ? "1" : "0",
            "blue",
          ],
          [
            "待提交",
            state.attempt?.status === "in_progress" ? "1" : "0",
            "amber",
          ],
          [
            "系统初评",
            state.attempt?.status === "submitted" ? "1" : "0",
            "violet",
          ],
          ["已发布", state.exam ? "1" : "0", "green"],
        ].map(([label, value, tone]) => (
          <div className={`metric-card ${tone}`} key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>场考试</small>
          </div>
        ))}
      </section>
      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <h2>考试列表</h2>
            <p>考试与学员状态</p>
          </div>
          <span className="table-count">共 {state.exam ? 1 : 0} 条</span>
        </div>
        {!state.exam ? (
          <EmptyState
            title="还没有考试"
            body="从预置病例创建第一场 OECE，约 1 分钟即可完成配置。"
            action={
              <button
                className="primary-button"
                onClick={() => go("/teacher/exams/new")}
              >
                创建第一场考试
              </button>
            }
          />
        ) : (
          <div
            className="exam-list-row"
            onClick={() => go(`/teacher/exams/${state.exam?.id}`)}
          >
            <div className="exam-badge">OE</div>
            <div className="exam-list-main">
              <strong>{state.exam.title}</strong>
              <span>
                {state.exam.caseName} · {state.exam.durationMinutes} 分钟 · 1
                名学员
              </span>
              <div className="stage-dots">
                {stages.map((item, index) => (
                  <i
                    className={
                      (state.attempt?.completedStages || []).includes(index + 1)
                        ? "done"
                        : ""
                    }
                    key={item}
                  >
                    {index + 1}
                  </i>
                ))}
              </div>
            </div>
            <span
              className={`state-pill ${status.includes("系统初评") ? "violet" : ""}`}
            >
              {status}
            </span>
            <button className="link-button">查看详情 →</button>
          </div>
        )}
      </section>
    </>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">＋</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

function ExamWizard({
  onPublish,
  onCancel,
}: {
  onPublish: (exam: Exam) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("心力衰竭病例 OECE 临床思维考核");
  const [description, setDescription] = useState(
    "完成重点病史采集、体格检查、辅助检查、病例汇报与诊疗计划。",
  );
  const [allowReturn, setAllowReturn] = useState(false);
  const [physicalOrderScoring, setPhysicalOrderScoring] = useState(true);
  const [auxiliaryOrderScoring, setAuxiliaryOrderScoring] = useState(true);
  const [dimensionWeights, setDimensionWeights] = useState<DimensionWeights>(() => ({ ...defaultDimensionWeights }));
  const weightSum = Object.values(dimensionWeights).reduce((sum, value) => sum + value, 0);
  const weightsValid = weightSum > 0 && Object.values(dimensionWeights).every(value => Number.isFinite(value) && value >= 0 && value <= 100);
  const [patient, setPatient] = useState<PatientProfile>(() => ({
    ...defaultPatientProfile,
    avatarStatus: "idle",
  }));
  const avatarTimer = useRef<number | null>(null);
  const [playingVoice, setPlayingVoice] = useState<PatientVoiceId | null>(null);
  useEffect(() => {
    return () => {
      if (avatarTimer.current) window.clearTimeout(avatarTimer.current);
      stopPatientPlayback();
    };
  }, []);
  const updatePatient = (partial: Partial<PatientProfile>) =>
    setPatient((previous) => ({ ...previous, ...partial }));
  const generateAvatar = () => {
    updatePatient({ avatarStatus: "generating" });
    if (avatarTimer.current) window.clearTimeout(avatarTimer.current);
    avatarTimer.current = window.setTimeout(
      () => updatePatient({ avatarStatus: "ready" }),
      1300,
    );
  };
  const previewVoice = (voiceId: PatientProfile["voiceId"]) => {
    updatePatient({ voiceId });
    setPlayingVoice(voiceId);
    speakPatientText(conversationScript[0].patient, () => setPlayingVoice(null));
  };
  const publish = () => {
    if (!weightsValid) return;
    onPublish({
      id: "EXAM-OECE-001",
      title,
      description,
      durationMinutes: 30,
      caseId: caseFixture.id,
      caseName: caseFixture.title,
      studentId: "shanyi-ai-2025-flora-beijing-medical-001",
      studentName: "编号 001 学员",
      status: "published",
      publishedAt: new Date().toISOString(),
      policy: {
        dimensionWeights: normalizeWeights(dimensionWeights),
        allowHistoryReview: true,
        allowSupplementalHistory: allowReturn,
        physicalOrderScoringEnabled: physicalOrderScoring,
        auxiliaryOrderScoringEnabled: auxiliaryOrderScoring,
      },
      patientProfile: { ...patient, avatarStatus: "ready" },
    });
  };
  const profileField = (key: keyof PatientProfile, label: string, rows = 3) => (
    <label>
      {label}
      <textarea
        rows={rows}
        value={String(patient[key])}
        onChange={(event) => updatePatient({ [key]: event.target.value })}
      />
    </label>
  );
  return (
    <>
      <PageIntro
        kicker="CREATE EXAM"
        title="新建 OECE 考试"
        description="配置考试、患者与考核规则。"
      />
      <div className="wizard-steps five">
        {["考试信息", "患者档案", "形象与声线", "学员与规则", "发布"].map(
          (item, index) => (
            <div
              className={`${step === index + 1 ? "active" : ""} ${step > index + 1 ? "done" : ""}`}
              key={item}
            >
              <b>{step > index + 1 ? "✓" : index + 1}</b>
              <span>{item}</span>
            </div>
          ),
        )}
      </div>
      <section className="wizard-card">
        {step === 1 && (
          <div className="form-stack">
            <SectionTitle number="01" title="考试信息" />
            <label>
              考试名称
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              考试说明
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="field-grid">
              <label>
                考试类型
                <input value="OECE · 独立评估" readOnly />
              </label>
              <label>
                总时长
                <input value="30 分钟" readOnly />
              </label>
            </div>
            <div className="case-select selected">
              <div className="case-thumb">心衰</div>
              <div>
                <span className="case-tag">
                  {caseFixture.subject} · {caseFixture.tertiaryDiscipline}
                </span>
                <h3>{caseFixture.title}</h3>
                <p>
                  {caseFixture.profile} · {caseFixture.complaint}
                </p>
              </div>
              <b>✓</b>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="form-stack patient-profile-form">
            <SectionTitle number="02" title="患者档案" />
            <div className="field-grid three">
              <label>
                患者姓名
                <input
                  value={patient.name}
                  onChange={(e) => updatePatient({ name: e.target.value })}
                />
              </label>
              <label>
                性别
                <select
                  value={patient.gender}
                  onChange={(e) =>
                    updatePatient({
                      gender: e.target.value as PatientProfile["gender"],
                    })
                  }
                >
                  <option>男</option>
                  <option>女</option>
                  <option>未知</option>
                </select>
              </label>
              <label>
                年龄
                <input
                  type="number"
                  min="1"
                  value={patient.age}
                  onChange={(e) =>
                    updatePatient({ age: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <div className="field-grid">
              <label>
                职业
                <input
                  value={patient.occupation}
                  onChange={(e) =>
                    updatePatient({ occupation: e.target.value })
                  }
                />
              </label>
              <label>
                婚姻状况
                <input
                  value={patient.maritalStatus}
                  onChange={(e) =>
                    updatePatient({ maritalStatus: e.target.value })
                  }
                />
              </label>
            </div>
            {profileField("chiefComplaint", "主诉", 2)}
            {profileField("presentIllness", "现病史", 4)}
            <div className="field-grid">
              {profileField("pastHistory", "既往史")}
              {profileField("personalHistory", "个人史")}
            </div>
            <div className="field-grid">
              {profileField("familyHistory", "家族史")}
              {profileField("allergyHistory", "过敏史")}
            </div>
            <details className="profile-more">
              <summary>体格检查、辅助检查与诊疗信息</summary>
              {profileField("physicalExam", "体格检查", 4)}
              {profileField("auxiliaryExam", "辅助检查", 4)}
            </details>
          </div>
        )}
        {step === 3 && (
          <div className="form-stack">
            <SectionTitle number="03" title="患者形象与声线" />
            <div className="avatar-builder">
              <div className={`avatar-preview ${patient.avatarStatus}`}>
                {patient.avatarStatus === "ready" ? <img
                  src="/assets/patient-guoman.png"
                  width="1456"
                  height="1092"
                  alt="标准化病人"
                /> : patient.avatarStatus === "idle" ? <div className="avatar-empty">生成后预览患者形象</div> : null}
                {patient.avatarStatus === "generating" && (
                  <div className="avatar-generating" aria-live="polite">
                    <span></span>
                    <strong>正在生成患者形象</strong>
                  </div>
                )}
              </div>
              <div className="avatar-config">
                <label>
                  患者相貌描述
                  <textarea
                    rows={6}
                    value={patient.appearanceDescription}
                    onChange={(e) =>
                      updatePatient({ appearanceDescription: e.target.value })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="outline-button"
                  disabled={patient.avatarStatus === "generating"}
                  onClick={generateAvatar}
                >
                  {patient.avatarStatus === "generating"
                    ? "生成中…"
                    : patient.avatarStatus === "ready"
                      ? "重新生成患者形象"
                      : "生成患者形象"}
                </button>
              </div>
            </div>
            <div className="voice-section">
              <h3>患者声线</h3>
              <div className="voice-groups">
                {(["男声", "女声"] as const).map((gender) => (
                  <section key={gender} className="voice-group">
                    <div className="voice-group-head">
                      <strong>{gender}</strong>
                      <span>{gender === "女声" ? "1 种可选" : "待配置"}</span>
                    </div>
                    <div className="voice-options">
                      {patientVoiceOptions
                        .filter((voice) => voice.gender === gender)
                        .map((voice) => (
                          <button
                            type="button"
                            disabled={!voice.available}
                            aria-pressed={patient.voiceId === voice.id}
                            className={[
                              patient.voiceId === voice.id ? "selected" : "",
                              playingVoice === voice.id ? "playing" : "",
                              !voice.available ? "unavailable" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={voice.id}
                            onClick={() => previewVoice(voice.id)}
                          >
                            <span className="voice-wave" aria-hidden="true">
                              <i></i>
                              <i></i>
                              <i></i>
                              <i></i>
                              <i></i>
                            </span>
                            <strong>
                              {voice.name}
                              {voice.recommended && <em>当前案例</em>}
                            </strong>
                            <small>{voice.detail}</small>
                            <span className="voice-status">
                              {!voice.available
                                ? "暂不可用"
                                : playingVoice === voice.id
                                  ? "播放中…"
                                  : patient.voiceId === voice.id
                                    ? "已选择"
                                    : "试听"}
                            </span>
                          </button>
                        ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="form-stack">
            <SectionTitle number="04" title="学员与规则" />
            <div className="student-select">
              <span className="avatar-lg">郭</span>
              <div>
                <strong>编号 001 学员</strong>
                <p>2025 年练习一 · 固定脚本演示</p>
              </div>
              <b>已分配</b>
            </div>
            <section className="dimension-weight-config">
              <h3>百分制总分 · 维度权重</h3>
              <p>各维度先除以自身满分，再按相对权重折算为100分。默认六维等权；填0表示不计入总分。</p>
              <div className="weight-grid">{scoringDimensions.map(({ id, title: dimensionTitle }) => <label key={id}><span>{dimensionTitle} <small>{weightSum > 0 ? `${(dimensionWeights[id] / weightSum * 100).toFixed(1)}%` : "—"}</small></span><input aria-label={`${dimensionTitle}权重`} type="number" min="0" max="100" step="1" value={dimensionWeights[id]} onChange={event => setDimensionWeights(previous => ({ ...previous, [id]: Number(event.target.value) }))} /></label>)}</div>
              <p>病史采集推理性暂不计分，不参与总分权重。</p>
              {!weightsValid && <p role="alert" className="weight-error">权重需在0至100之间，且至少一项大于0。</p>}
            </section>
            <div className="policy-list">
              <label>
                <div>
                  <strong>允许查看过往阶段</strong>
                  <span>可查看已提交阶段的信息</span>
                </div>
                <input type="checkbox" checked readOnly />
              </label>
              <label>
                <div>
                  <strong>允许补充问诊</strong>
                  <span>开启后可在任意阶段继续向患者提问；关闭时只读历史对话</span>
                </div>
                <input
                  type="checkbox"
                  checked={allowReturn}
                  onChange={(e) => setAllowReturn(e.target.checked)}
                />
              </label>
              <label>
                <div>
                  <strong>提交后锁定当前阶段</strong>
                  <span>已提交内容不可修改</span>
                </div>
                <input type="checkbox" checked readOnly />
              </label>
              <label className="order-scoring-policy">
                <div>
                  <strong>体格检查排序计分</strong>
                  <span>考生始终可以排序；关闭后顺序只记录、不计分</span>
                </div>
                <span className="policy-control">
                  <input
                    type="checkbox"
                    checked={physicalOrderScoring}
                    onChange={(event) => setPhysicalOrderScoring(event.target.checked)}
                  />
                </span>
              </label>
              <label className="order-scoring-policy">
                <div>
                  <strong>辅助检查排序计分</strong>
                  <span>考生始终可以排序；关闭后顺序只记录、不计分</span>
                </div>
                <span className="policy-control">
                  <input
                    type="checkbox"
                    checked={auxiliaryOrderScoring}
                    onChange={(event) => setAuxiliaryOrderScoring(event.target.checked)}
                  />
                </span>
              </label>
            </div>
          </div>
        )}
        {step === 5 && (
          <div className="form-stack">
            <SectionTitle number="05" title="确认并发布" />
            <div className="summary-grid">
              <SummaryItem label="考试名称" value={title} />
              <SummaryItem
                label="患者"
                value={`${patient.name} · ${patient.gender} · ${patient.age} 岁`}
              />
              <SummaryItem label="主诉" value={patient.chiefComplaint} />
              <SummaryItem
                label="患者声线"
                value={voiceNameMap[patient.voiceId]}
              />
              <SummaryItem label="学员" value="编号 001 学员（1 人）" />
              <SummaryItem label="时长" value="30 分钟" />
              <SummaryItem label="阶段" value="4 个阶段" />
              <SummaryItem label="总分" value="100分 · 六个维度加权" />
              <SummaryItem label="维度权重" value={scoringDimensions.map(({id, title: name}) => `${name} ${(dimensionWeights[id] / weightSum * 100).toFixed(1)}%`).join("；")} />
              <SummaryItem
                label="补充问诊"
                value={allowReturn ? "允许" : "仅查看转录"}
              />
              <SummaryItem
                label="体查排序评分"
                value={physicalOrderScoring ? "计入评分" : "不计入评分"}
              />
              <SummaryItem
                label="辅检排序评分"
                value={auxiliaryOrderScoring ? "计入评分" : "不计入评分"}
              />
            </div>
          </div>
        )}
        <div className="wizard-actions">
          <button type="button" className="demo-helper" disabled={!weightsValid} onClick={publish}>一键建考（Demo）</button>
          <button
            className="ghost-button"
            onClick={
              step === 1 ? onCancel : () => setStep((current) => current - 1)
            }
          >
            {step === 1 ? "取消" : "上一步"}
          </button>
          {step < 5 ? (
            <button
              className="primary-button"
              onClick={() => setStep((current) => current + 1)}
            >
              下一步
            </button>
          ) : (
            <button className="primary-button" disabled={!weightsValid} onClick={publish}>
              发布考试
            </button>
          )}
        </div>
      </section>
    </>
  );
}

function SectionTitle({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="section-title">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}
function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TeacherExamDetail({
  state,
  go,
}: {
  state: DemoState;
  go: (path: string) => void;
}) {
  const exam = state.exam!;
  const attempt = state.attempt!;
  const submitted = attempt.status === "submitted";
  return (
    <>
      <PageIntro
        kicker="EXAM DETAIL"
        title={exam.title}
        description={`${exam.caseName} · 发布于 ${formatTime(exam.publishedAt)}`}
        action={
          <button className="ghost-button" onClick={() => go("/student/tasks")}>
            切换学员端预览 →
          </button>
        }
      />
      <section className="detail-hero">
        <div>
          <span className={`state-pill ${submitted ? "violet" : ""}`}>
            {statusLabel(state)}
          </span>
          <h2>
            {caseFixture.patient} · {caseFixture.complaint}
          </h2>
          <p>
            {caseFixture.profile} · {caseFixture.vitals}
          </p>
        </div>
        <div className="detail-stat">
          <span>考试时长</span>
          <strong>30 min</strong>
        </div>
        <div className="detail-stat">
          <span>分配学员</span>
          <strong>1</strong>
        </div>
      </section>
      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <h2>学员进度</h2>
            <p>查看考试状态与下一步操作</p>
          </div>
        </div>
        <div className="student-row">
          <span className="avatar-lg">郭</span>
          <div>
            <strong>编号 001 学员</strong>
            <p>2025 年练习一</p>
          </div>
          <div>
            <small>当前状态</small>
            <b>{statusLabel(state)}</b>
          </div>
          <div>
            <small>提交时间</small>
            <b>{formatTime(attempt.submittedAt)}</b>
          </div>
          {submitted ? (
            <button
              className="primary-button"
              onClick={() =>
                go(`/teacher/submissions/${attempt.id}/evaluation`)
              }
            >
              查看评估
            </button>
          ) : (
            <button
              className="ghost-button"
              onClick={() => go("/student/tasks")}
            >
              查看学员端
            </button>
          )}
        </div>
      </section>
    </>
  );
}

function StudentTasks({
  state,
  go,
  onDemoComplete,
}: {
  state: DemoState;
  go: (path: string) => void;
  onDemoComplete: () => void;
}) {
  const exam = state.exam;
  const attempt = state.attempt;
  return (
    <>
      <PageIntro
        kicker="MY EXAMS"
        title="我的考试"
        description="查看待完成任务、考试进度与评估状态。"
      />
      <div className="student-banner">
        <div>
          <span>你好，编号 001 学员</span>
          <h2>{exam ? "你有 1 项 OECE 任务待处理" : "当前没有待完成任务"}</h2>
          <p>请在安静环境中完成考试，过程中系统会自动保存。</p>
        </div>
        <div className="banner-orbit">OECE</div>
      </div>
      {!exam ? (
        <section className="panel-card">
          <EmptyState
            title="暂无考试任务"
            body="请先切换教师端创建并发布一场考试。"
            action={
              <button
                className="primary-button"
                onClick={() => go("/teacher/exams/new")}
              >
                前往教师端建考
              </button>
            }
          />
        </section>
      ) : (
        <section className="task-card">
          <div className="task-date">
            <strong>30</strong>
            <span>分钟</span>
          </div>
          <div className="task-main">
            <span className="case-tag">
              {caseFixture.subject} · {caseFixture.tertiaryDiscipline}
            </span>
            <h2>{exam.title}</h2>
            <p>
              {caseFixture.patient}，{caseFixture.profile}，
              {caseFixture.complaint}
            </p>
            <div className="task-meta">
              <span>◷ 4 个阶段</span>
              <span>▣ 自动保存</span>
              <span>
                ◎{" "}
                {exam.policy.allowSupplementalHistory
                  ? "允许补充问诊"
                  : "过往阶段只读"}
              </span>
            </div>
          </div>
          <div className="task-action">
            <span
              className={`state-pill ${attempt?.status === "submitted" ? "violet" : ""}`}
            >
              {statusLabel(state)}
            </span>
            {attempt?.status === "submitted" ? (
              <button
                className="primary-button"
                onClick={() => go(`/student/results/${attempt.id}`)}
              >
                查看评估
              </button>
            ) : attempt?.status === "in_progress" ? (
              <button
                className="primary-button"
                onClick={() =>
                  go(
                    `/student/exam/${attempt.id}/stage/${attempt.currentStage}`,
                  )
                }
              >
                继续考试
              </button>
            ) : (
              <button
                className="primary-button"
                onClick={() => go(`/student/tasks/${exam.id}/brief`)}
              >
                查看任务
              </button>
            )}
            {attempt?.status !== "submitted" && <button type="button" className="demo-helper" onClick={onDemoComplete}>一键考试（Demo）</button>}
          </div>
        </section>
      )}
    </>
  );
}

function BriefPage({
  state,
  go,
  updateAttempt,
}: {
  state: DemoState;
  go: (path: string) => void;
  updateAttempt: (updater: (attempt: Attempt) => Attempt) => void;
}) {
  if (!state.exam || !state.attempt) return null;
  const start = () => {
    updateAttempt((a) => ({
      ...a,
      status: "in_progress",
      startedAt: a.startedAt || new Date().toISOString(),
    }));
    go(`/student/exam/${state.attempt!.id}/stage/1`);
  };
  return (
    <>
      <PageIntro
        kicker="EXAM BRIEF"
        title="考前说明"
        description="开始前请确认任务、规则与患者基本信息。"
      />
      <section className="brief-layout refined">
        <div className="brief-main panel-card">
          <div className="brief-heading">
            <span className="case-tag">考生指引</span>
            <h2>{state.exam.title}</h2>
            <div className="brief-meta">
              <span>{caseFixture.subject}</span>
              <span>{caseFixture.tertiaryDiscipline}</span>
              <span>30 分钟</span>
              <span>4 个阶段</span>
            </div>
          </div>
          <div className="patient-strip">
            <div className="patient-mini">郭</div>
            <div>
              <span>接诊患者</span>
              <strong>{state.exam.patientProfile.name}</strong>
              <p>
                {state.exam.patientProfile.gender} · {state.exam.patientProfile.age} 岁 · {state.exam.patientProfile.chiefComplaint}
              </p>
            </div>
          </div>
          <div className="brief-section-title">
            <span>考试流程</span>
            <h3>依次完成四个阶段</h3>
          </div>
          <ol className="brief-tasks">
            {stages.map((item, index) => (
              <li key={item}>
                <b>{index + 1}</b>
                <div>
                  <strong>{item}</strong>
                  <span>
                    {
                      [
                        "完成重点病史采集并提交初步诊断",
                        "提交体格检查、解读结果并完成诊断修正",
                        "提交辅助检查项目并解读结果",
                        "完成病例汇报、最终诊断与诊疗计划",
                      ][index]
                    }
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <aside className="brief-side">
          <div className="rule-card">
            <div className="rule-card-head">
              <span>开始前确认</span>
              <h3>考试规则</h3>
            </div>
            <dl>
              <div><dt>总时长</dt><dd>30 分钟</dd></div>
              <div><dt>阶段模式</dt><dd>依次提交</dd></div>
              <div><dt>历史信息</dt><dd>可回看</dd></div>
              <div><dt>补充问诊</dt><dd>
                {state.exam.policy.allowSupplementalHistory
                  ? "允许"
                  : "不可继续"}
              </dd></div>
              <div><dt>体查排序</dt><dd>
                {state.exam.policy.physicalOrderScoringEnabled
                  ? "计分"
                  : "不计分"}
              </dd></div>
              <div><dt>辅检排序</dt><dd>
                {state.exam.policy.auxiliaryOrderScoringEnabled
                  ? "计分"
                  : "不计分"}
              </dd></div>
            </dl>
          </div>
          <button className="primary-button start-button" onClick={start}>
            我已了解，开始考试 →
          </button>
          <button className="text-button" onClick={() => go("/student/tasks")}>
            返回任务列表
          </button>
        </aside>
      </section>
    </>
  );
}

function ExamTimer({
  startedAt,
  durationMinutes,
}: {
  startedAt?: string;
  durationMinutes: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(
    0,
    durationMinutes * 60 -
      Math.floor(
        (now - (startedAt ? new Date(startedAt).getTime() : now)) / 1000,
      ),
  );
  return (
    <strong className={seconds < 180 ? "timer danger" : "timer"}>
      {String(Math.floor(seconds / 60)).padStart(2, "0")}:
      {String(seconds % 60).padStart(2, "0")}
      {seconds === 0 && <small>已超时 · 可继续作答并提交</small>}
    </strong>
  );
}

function ExamWorkspace({
  saveStatus,
  state,
  updateAttempt,
  go,
  onDemoComplete,
}: {
  saveStatus: string;
  state: DemoState;
  updateAttempt: (updater: (attempt: Attempt) => Attempt) => void;
  go: (path: string) => void;
  onRole: (role: "teacher" | "student") => void;
  onDemoComplete: () => void;
}) {
  const attempt = state.attempt;
  const exam = state.exam;
  const [notesOpen, setNotesOpen] = useState(false);
  const [conversationState, setConversationState] = useState<
    "idle" | "recording" | "thinking" | "speaking"
  >("idle");
  const conversationTimers = useRef<number[]>([]);
  const stageFromPath = Number(window.location.pathname.split("/").pop());
  useEffect(() => {
    const timers = conversationTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.length = 0;
      stopPatientPlayback();
    };
  }, [stageFromPath]);
  if (!attempt || !exam)
    return <div className="loading-screen">请先创建考试</div>;
  if (![1, 2, 3, 4].includes(stageFromPath) || stageFromPath > attempt.currentStage || window.location.pathname.split("/")[3] !== attempt.id)
    return <div className="loading-screen"><p>当前阶段尚未开放或考试地址无效。</p><button className="primary-button" onClick={() => go(`/student/exam/${attempt.id}/stage/${Math.min(4, attempt.currentStage)}`)}>返回当前阶段</button></div>;
  const isPast = stageFromPath < attempt.currentStage;
  const editable = !isPast && attempt.status !== "submitted";
  const changeAttempt = (partial: Partial<Attempt>) =>
    updateAttempt((a) => ({ ...a, ...partial }));
  const visitStage = (index: number) => {
    if (index <= attempt.currentStage)
      go(`/student/exam/${attempt.id}/stage/${index}`);
  };
  const completeStage = (stage: number) =>
    updateAttempt((a) => ({
      ...a,
      completedStages: Array.from(new Set([...a.completedStages, stage])),
      currentStage: Math.max(a.currentStage, stage + 1),
    }));
  const playPatientAnswer = (answerIndex: number, trackState = false) => {
    if (trackState) setConversationState("thinking");
    speakPatientText(conversationScript[answerIndex].patient, () => {
      if (trackState) setConversationState("idle");
    }, () => { if (trackState) setConversationState("speaking"); });
  };
  const replayPatientAnswer = (text: string) => {
    const answerIndex = conversationScript.findIndex(
      (pair) => pair.patient === text,
    );
    if (answerIndex >= 0) playPatientAnswer(answerIndex, true);
    else speakPatientText(text, () => setConversationState("idle"));
  };
  const nextConversation = () => {
    if (!editable) return;
    const nextIndex = attempt.transcript.filter(
      (turn) => turn.speaker === "student" && turn.mode !== "live",
    ).length;
    if (nextIndex >= conversationScript.length || conversationScript[nextIndex].stage > stageFromPath || conversationState !== "idle")
      return;
    const pair = conversationScript[nextIndex];
    const base = Date.now();
    setConversationState("recording");
    conversationTimers.current.push(window.setTimeout(() => setConversationState("thinking"), 650));
    conversationTimers.current.push(
      window.setTimeout(() => {
        updateAttempt((a) => a.currentStage !== stageFromPath ? a : ({
          ...a,
          transcript: [
            ...a.transcript,
            { id: `s-${base}`, speaker: "student", text: pair.student, stage: stageFromPath, mode: "scripted", time: new Date().toLocaleTimeString("zh-CN"), sourceTurn: nextIndex + 1, sourceTime: pair.askedAt },
            {
              id: `p-${base}`,
              speaker: "patient",
              text: pair.patient,
              stage: stageFromPath,
              mode: "scripted",
              sourceTurn: nextIndex + 1,
              sourceTime: pair.answeredAt,
              time: new Date().toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ],
        }));
        playPatientAnswer(nextIndex, true);
      }, 1750),
    );
  };
  const fillConversation = () =>
    updateAttempt((a) => ({
      ...a,
      transcript: (() => {
        const completedPairs = a.transcript.filter(
          (turn) => turn.speaker === "patient" && turn.mode !== "live",
        ).length;
        const hasPendingStudent =
          a.transcript.at(-1)?.speaker === "student" && a.transcript.at(-1)?.mode !== "live" &&
          completedPairs < conversationScript.length;
        const pendingPatient = hasPendingStudent
          ? [
              {
                id: `dp-${completedPairs}`,
                speaker: "patient" as const,
                text: conversationScript[completedPairs].patient,
                time: scriptedTurnTime(completedPairs, true),
                stage: conversationScript[completedPairs].stage,
                mode: "scripted" as const,
                sourceTurn: completedPairs + 1,
                sourceTime: conversationScript[completedPairs].answeredAt,
              },
            ]
          : [];
        const start = completedPairs + (hasPendingStudent ? 1 : 0);
        const remaining = conversationScript.slice(start, 25).flatMap((pair, offset) => {
          const index = start + offset;
          return [
            {
              id: `ds-${index}`,
              speaker: "student" as const,
              text: pair.student,
              stage: 1,
              mode: "scripted" as const,
              time: scriptedTurnTime(index),
              sourceTurn: index + 1,
              sourceTime: pair.askedAt,
            },
            {
              id: `dp-${index}`,
              speaker: "patient" as const,
              text: pair.patient,
              stage: 1,
              mode: "scripted" as const,
              time: scriptedTurnTime(index, true),
              sourceTurn: index + 1,
              sourceTime: pair.answeredAt,
            },
          ];
        });
        return [...a.transcript, ...pendingPatient, ...remaining];
      })(),
      historyDiagnoses: [
        {
          ...blankDiagnosis("history-heart-failure"),
          name: "急性失代偿性心力衰竭",
        },
        {
          ...blankDiagnosis("history-ild"),
          name: "间质性肺病",
        },
        {
          ...blankDiagnosis("history-copd"),
          name: "慢性阻塞性肺疾病IV级",
        },
      ],
    }));
  return (
    <main className="exam-shell exam-focus">
      <a className="skip-link" href="#exam-content">
        跳到当前阶段
      </a>
      <aside className="exam-rail" aria-label="考试导航">
        <strong className="rail-title">OECE 考试</strong>
        <nav className="stage-tabs" aria-label="考试阶段">{stages.map((item, index) => {
          const number = index + 1;
          return <button key={item} disabled={number > attempt.currentStage} aria-current={number === stageFromPath ? "step" : undefined} className={`${number === stageFromPath ? "active" : ""} ${attempt.completedStages.includes(number) ? "done" : ""}`} onClick={() => visitStage(number)}><b>{attempt.completedStages.includes(number) ? "✓" : number}</b><span>{item}</span><small>{attempt.status === "submitted" ? "已提交 · 可回看" : number > attempt.currentStage ? "未开放" : number === attempt.currentStage ? "进行中" : "已提交 · 可回看"}</small></button>;
        })}</nav>
        <div className="rail-status"><ExamTimer startedAt={attempt.startedAt} durationMinutes={exam.durationMinutes} /><span className="save-status" role="status">{saveStatus}</span></div>
        <div className="rail-actions"><button className="outline-button" onClick={() => go("/student/tasks")}>返回任务</button>{attempt.status !== "submitted" && <button type="button" className="demo-helper" onClick={onDemoComplete}>一键考试（Demo）</button>}</div>
      </aside>
      <section className="stage-content" id="exam-content">
      {isPast && (
        <div className="readonly-banner">
          {attempt.status === "submitted" ? "考试已提交，作答只读；可返回第一阶段继续问诊。" : "当前正在回看已提交阶段，作答只读；补充问诊请返回第一阶段。"}
        </div>
      )}
        {stageFromPath === 1 && (
          <HistoryStage
            attempt={attempt}
            editable={editable}
            allowSupplemental={exam.policy.allowSupplementalHistory}
            change={changeAttempt}
            conversationState={conversationState}
            nextConversation={nextConversation}
            replayPatientAnswer={replayPatientAnswer}
            cancelConversation={() => {
              conversationTimers.current.forEach(timer => window.clearTimeout(timer));
              conversationTimers.current.length = 0;
              stopPatientPlayback();
              setConversationState("idle");
            }}
            quickFill={() => {
              conversationTimers.current.forEach(timer => window.clearTimeout(timer));
              conversationTimers.current.length = 0;
              stopPatientPlayback();
              setConversationState("idle");
              fillConversation();
            }}
            onSubmit={() => {
              updateAttempt((a) => ({
                ...a,
                completedStages: Array.from(
                  new Set([...a.completedStages, 1]),
                ),
                currentStage: Math.max(a.currentStage, 2),
                physicalDiagnoses: a.historyDiagnoses.map((diagnosis, index) => ({
                  ...diagnosis,
                  id: `physical-${index}-${Date.now()}`,
                })),
              }));
              go(`/student/exam/${attempt.id}/stage/2`);
            }}
          />
        )}
        {stageFromPath === 2 && (
          <PhysicalStage
            attempt={attempt}
            policy={exam.policy}
            editable={editable}
            change={changeAttempt}
            onSubmit={() => {
              updateAttempt((a) => ({
                ...a,
                completedStages: Array.from(
                  new Set([...a.completedStages, 2]),
                ),
                currentStage: Math.max(a.currentStage, 3),
                finalDiagnoses: a.physicalDiagnoses.map((diagnosis, index) => ({
                  ...diagnosis,
                  id: `final-${index}-${Date.now()}`,
                })),
              }));
              go(`/student/exam/${attempt.id}/stage/3`);
            }}
          />
        )}
        {stageFromPath === 3 && (
          <AuxiliaryStage
            attempt={attempt}
            policy={exam.policy}
            editable={editable}
            change={changeAttempt}
            onSubmit={() => {
              completeStage(3);
              go(`/student/exam/${attempt.id}/stage/4`);
            }}
          />
        )}
        {stageFromPath === 4 && (
          <FinalStage
            attempt={attempt}
            editable={editable}
            change={changeAttempt}
            updateAttempt={updateAttempt}
            onSubmit={() => {
              updateAttempt((a) => ({
                ...a,
                completedStages: [1, 2, 3, 4],
                status: "submitted",
                submittedAt: new Date().toISOString(),
              }));
              go(`/student/results/${attempt.id}`);
            }}
          />
        )}
      </section>
      <button className="floating-notes" onClick={() => setNotesOpen(true)}>
        <span>✎</span>
        <b>草稿记录</b>
      </button>
      {notesOpen && (
        <div className="drawer-backdrop" onClick={() => setNotesOpen(false)}>
          <aside className="notes-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <span>临床记录</span>
                <h2>诊断过程思考记录</h2>
              </div>
              <button
                aria-label="关闭草稿记录"
                onClick={() => setNotesOpen(false)}
              >
                ×
              </button>
            </div>
            <label className="free-draft">
              自由草稿
              <textarea
                readOnly={!editable}
                value={attempt.draft}
                onChange={(e) => changeAttempt({ draft: e.target.value })}
                placeholder=""
                aria-label="草稿记录"
              />
            </label>
            <div className="drawer-save" role="status">{saveStatus}</div>
          </aside>
        </div>
      )}
    </main>
  );
}

function StageHeading({
  number,
  title,
  instruction,
  quickFill,
}: {
  number: string;
  title: string;
  instruction?: string;
  quickFill?: () => void;
}) {
  return (
    <div className="stage-heading">
      <div>
        <p>STAGE {number}</p>
        <h1>{title}</h1>
        {instruction && <span>{instruction}</span>}
      </div>
      {quickFill && (
        <button className="demo-helper" onClick={quickFill}>
          快速填写
        </button>
      )}
    </div>
  );
}

function HistoryStage({
  attempt,
  editable,
  allowSupplemental,
  change,
  conversationState,
  nextConversation,
  replayPatientAnswer,
  cancelConversation,
  quickFill,
  onSubmit,
}: {
  attempt: Attempt;
  editable: boolean;
  allowSupplemental: boolean;
  change: (partial: Partial<Attempt>) => void;
  conversationState: "idle" | "recording" | "thinking" | "speaking";
  nextConversation: () => void;
  replayPatientAnswer: (text: string) => void;
  cancelConversation: () => void;
  quickFill: () => void;
  onSubmit: () => void;
}) {
  const [patientTab, setPatientTab] = useState<"scripted" | "live">("scripted");
  const latestPatient = [...attempt.transcript]
    .reverse()
    .find((t) => t.speaker === "patient");
  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (transcriptRef.current)
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [attempt.transcript.length]);
  const stateLabel = {
    idle: attempt.transcript.filter(turn => turn.speaker === "patient" && turn.mode !== "live").length >= 25 ? "病患对话演示已结束" : attempt.transcript.length ? "继续对话回放" : "开始对话回放",
    recording: "正在加载历史提问…",
    thinking: "患者正在思考…",
    speaking: "患者正在回答…",
  }[conversationState];
  return (
    <>
      <StageHeading
        number="01"
        title="重点病史采集"
        instruction="与标准化病人沟通并完成病史记录。"
        quickFill={editable ? quickFill : undefined}
      />
      <div className="patient-mode-tabs" role="group" aria-label="患者交互模式">
        <button type="button" aria-pressed={patientTab === "scripted"} onClick={() => { cancelConversation(); setPatientTab("scripted"); }}>病患对话演示</button>
        <button type="button" aria-pressed={patientTab === "live"} onClick={() => { cancelConversation(); setPatientTab("live"); }}>实时交互体验</button>
      </div>
      {patientTab === "live" ? (
        <LivePatientChat key={`${attempt.id}-live`} storageKey={`oece-patient-experience-v2:${attempt.id}`} allowSupplemental={allowSupplemental} />
      ) : (
      <div className="history-layout">
        <section className="patient-stage">
          <div
            className={`patient-frame ${conversationState === "speaking" ? "speaking" : ""} ${conversationState === "thinking" ? "thinking" : ""}`}
          >
            <PatientMedia alt="58岁女性标准化病人郭曼，坐于病房床上" />
            <div className="room-badge">
              <span>
                <i></i>历史回放
              </span>
              <small>急诊留观室 · 床旁评估</small>
            </div>
            <div className="patient-vitals">
              <span>
                <small>HR</small>
                <b>97</b>
              </span>
              <span>
                <small>SpO₂</small>
                <b>90%</b>
              </span>
              <span>
                <small>BP</small>
                <b>111/79</b>
              </span>
            </div>
            <div className="patient-overlay">
              <span>{caseFixture.patient}</span>
              <small>{caseFixture.profile} · 病房</small>
            </div>
            <div className="voice-rings"></div>
            {conversationState === "thinking" && (
              <div className="patient-thinking" aria-live="polite">
                <i></i>
                <i></i>
                <i></i>
                <span>正在思考</span>
              </div>
            )}
          </div>
          <PatientMediaTools />
          <div className="recent-audio">
            <button
              type="button"
              aria-label="播放患者最近回答"
              disabled={!latestPatient || conversationState !== "idle"}
              onClick={() =>
                latestPatient && replayPatientAnswer(latestPatient.text)
              }
            >
              ▶
            </button>
            <div>
              <strong>{latestPatient ? "患者最近回答" : "等待开始问诊"}</strong>
              <span>
                {latestPatient?.text || "点击下方按钮，播放第一轮历史对话"}
              </span>
            </div>
            <div className="mini-wave" aria-hidden="true">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                <i key={i}></i>
              ))}
            </div>
          </div>
          <button
            disabled={
              !editable ||
              conversationState !== "idle" ||
              attempt.transcript.filter((t) => t.speaker === "patient" && t.mode !== "live")
                .length >= 25
            }
            className={`mic-button ${conversationState}`}
            onClick={nextConversation}
          >
            <span aria-hidden="true">
              {conversationState === "idle"
                ? "●"
                : conversationState === "recording"
                  ? "■"
                  : "•••"}
            </span>
            <b>{stateLabel}</b>
            <small>
              {conversationState === "idle" ? attempt.transcript.filter(turn => turn.speaker === "patient" && turn.mode !== "live").length >= 25 ? "可在下方继续补充问诊" : "播放下一轮历史对话" : "请稍候"}
            </small>
          </button>
        </section>
        <aside className="transcript-panel">
          <div className="transcript-head">
            <div>
              <span className="live-dot"></span>
              <strong>沟通记录</strong>
            </div>
            <small>{attempt.transcript.length} 条</small>
          </div>
          <div className="transcript-list" ref={transcriptRef}>
            {attempt.transcript.length === 0 ? (
              <div className="transcript-empty">
                <span>⌁</span>
                <strong>尚未开始问诊</strong>
                <p>对话内容将在这里按时间顺序显示。</p>
              </div>
            ) : (
              attempt.transcript.map((turn) => (
                <div className={`turn ${turn.speaker}`} key={turn.id}>
                  <div>
                    <b>{turn.speaker === "student" ? "考生" : "郭曼"}</b>
                    <time>阶段{turn.stage ?? 1} · {turn.mode === "live" ? "自主问诊" : "历史回放"} · {turn.time}</time>
                  </div>
                  <p>{turn.text}</p>
                  {turn.speaker === "patient" && (
                    <button
                      type="button"
                      aria-label={`重听${turn.time}的患者回答`}
                      disabled={conversationState !== "idle"}
                      onClick={() => replayPatientAnswer(turn.text)}
                    >
                      ▷ 重听
                    </button>
                  )}
                </div>
              ))
            )}
            {conversationState === "thinking" && (
              <div className="turn patient pending">
                <b>郭曼</b>
                <p>
                  <i></i>
                  <i></i>
                  <i></i>
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
      )}
      {patientTab === "scripted" && allowSupplemental && (attempt.transcript.filter(turn => turn.speaker === "patient" && turn.mode !== "live").length >= 25 || !editable) && <LivePatientChat key={`${attempt.id}-supplemental`} compact storageKey={`oece-patient-supplemental-v1:${attempt.id}`} context={attempt.transcript.filter(turn => turn.mode !== "live").map(turn => ({ role: turn.speaker === "student" ? "user" : "assistant", content: turn.text }))} />}
      <DiagnosisNameEditor
        title="初步诊断"
        entries={attempt.historyDiagnoses}
        disabled={!editable}
        onChange={(historyDiagnoses) => change({ historyDiagnoses })}
      />
      <div className="stage-submit-bar compact">
        <div>
          <strong>阶段证据</strong>
          <span>
            病患沟通转录 · 已完成{" "}
            {attempt.transcript.filter((t) => t.speaker === "patient" && t.mode !== "live").length}/
            31 轮（含跨阶段补问）
          </span>
        </div>
        <button
          className="primary-button"
          disabled={
            !editable ||
            attempt.transcript.filter((t) => t.speaker === "patient").length <
              3 ||
            !attempt.historyDiagnoses.some((diagnosis) => diagnosis.name.trim())
          }
          onClick={onSubmit}
        >
          提交病史与初步诊断 →
        </button>
      </div>
    </>
  );
}

function AutocompleteInput({
  value,
  onChange,
  library,
  label,
  placeholder,
  disabled,
  remote,
}: {
  value: string;
  onChange: (value: string) => void;
  library: SearchLibraryItem[];
  label: string;
  placeholder: string;
  disabled?: boolean;
  remote?: "diagnosis";
}) {
  const listId = useId();
  const deferredValue = useDeferredValue(value.trim().toLowerCase());
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [remoteMatches, setRemoteMatches] = useState<SearchLibraryItem[]>([]);
  useEffect(() => {
    if (remote !== "diagnosis" || !deferredValue) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/diagnoses?q=${encodeURIComponent(deferredValue)}`, { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json() as { items: { code: string; name: string }[] };
        setRemoteMatches(data.items.map(item => ({ ...item, keywords: [item.code] })));
      } catch { /* The local suggestions remain available when offline. */ }
    }, 160);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [deferredValue, remote]);
  const localMatches = deferredValue
    ? library
        .filter((item) =>
          [item.name, ...item.keywords].some((term) =>
            term.toLowerCase().includes(deferredValue),
          ),
        )
        .slice(0, 6)
    : [];
  const matches = remote === "diagnosis" ? [...localMatches, ...remoteMatches.filter(item => !localMatches.some(local => local.name === item.name))].filter(item => [item.name, ...item.keywords].some(term => term.toLowerCase().includes(deferredValue))).slice(0, 12) : localMatches;
  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setActiveIndex(0);
  };
  return (
    <div className="autocomplete-field">
      <input
        aria-label={label}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-activedescendant={
          open && matches[activeIndex]
            ? `${listId}-option-${activeIndex}`
            : undefined
        }
        autoComplete="off"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (!open || !matches.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % matches.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex(
              (current) => (current - 1 + matches.length) % matches.length,
            );
          } else if (event.key === "Enter") {
            event.preventDefault();
            select(matches[activeIndex].name);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && deferredValue && matches.length > 0 && (
        <div className="autocomplete-menu" id={listId} role="listbox">
          {matches.length ? (
            matches.map((item, index) => (
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                id={`${listId}-option-${index}`}
                className={index === activeIndex ? "active" : ""}
                key={item.code ?? item.name}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(item.name)}
              >
                <span>{item.name}</span>
                <small>{item.keywords.slice(0, 3).join(" · ")}</small>
              </button>
            ))
          ) : (
            <div className="autocomplete-empty">未匹配到库内项目</div>
          )}
        </div>
      )}
    </div>
  );
}

function DiagnosisNameEditor({
  title,
  entries,
  onChange,
  disabled,
  previous,
}: {
  title: string;
  entries: DiagnosisEntry[];
  onChange: (entries: DiagnosisEntry[]) => void;
  disabled?: boolean;
  previous?: DiagnosisEntry[];
}) {
  const updateName = (index: number, name: string) =>
    onChange(
      entries.map((entry, itemIndex) =>
        itemIndex === index ? { ...entry, name } : entry,
      ),
    );
  return (
    <section className="diagnosis-checkpoint">
      <div className="card-title">
        <div>
          <span>DIAGNOSIS CHECKPOINT</span>
          <h2>{title}</h2>
        </div>
        <small>{entries.filter((entry) => entry.name.trim()).length} 项</small>
      </div>
      {previous?.some((entry) => entry.name.trim()) ? (
        <div className="previous-diagnoses">
          <span>病史采集提交</span>
          <div>
            {previous
              .filter((entry) => entry.name.trim())
              .map((entry) => (
                <b key={entry.id}>{entry.name}</b>
              ))}
          </div>
        </div>
      ) : null}
      <div className="diagnosis-name-list">
        {entries.map((entry, index) => (
          <div className="diagnosis-name-row" key={entry.id}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <AutocompleteInput
              value={entry.name}
              onChange={(value) => updateName(index, value)}
              library={diagnosisLibrary}
              remote="diagnosis"
              label={`鉴别诊断 ${index + 1}`}
              placeholder="输入诊断关键词"
              disabled={disabled}
            />
            {!disabled && entries.length > 1 ? (
              <button
                type="button"
                aria-label={`删除鉴别诊断 ${index + 1}`}
                onClick={() =>
                  onChange(entries.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                删除
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {!disabled ? (
        <button
          type="button"
          className="add-row-button block"
          onClick={() =>
            onChange([
              ...entries,
              blankDiagnosis(`diagnosis-${Date.now()}-${entries.length}`),
            ])
          }
        >
          ＋ 添加鉴别诊断
        </button>
      ) : null}
    </section>
  );
}

function PhysicalStage({ attempt, policy, editable, change, onSubmit }: {
  attempt: Attempt; policy: Exam["policy"]; editable: boolean; change: (partial: Partial<Attempt>) => void; onSubmit: () => void;
}) {
  const quick = () => change({
    physicalItems: [
      ["心脏听诊", "心尖部收缩期杂音及额外心音，提示心功能异常。"],
      ["双肺听诊", "双肺底湿啰音，提示肺淤血。"],
      ["颈静脉怒张检查", "颈静脉充盈，提示体循环淤血。"],
      ["肝颈静脉回流征", "回流征阳性，支持右心充盈压升高。"],
      ["下肢水肿检查", "双踝凹陷性水肿，支持容量负荷增加。"],
    ].map(([label, interpretation], index) => ({ id: `pf${index}`, label, interpretation, result: fixedCheckResult("physical", label), generatedAt: new Date().toISOString() })),
    physicalRevealed: true,
    physicalDiagnoses: ["急性失代偿性心力衰竭", "间质性肺病", "慢性阻塞性肺疾病IV级"].map((name, index) => ({ ...blankDiagnosis(`physical-${index}`), name })),
  });
  const filled = attempt.physicalItems.filter(item => item.label.trim());
  const ready = filled.length > 0 && !duplicateChecks(filled) && filled.every(item => item.result && item.result.kind !== "clarification" && item.interpretation.trim()) && attempt.physicalItems.every(item => item.label.trim()) && attempt.physicalDiagnoses.some(item => item.name.trim());
  return <>
    <StageHeading number="02" title="体格检查" quickFill={editable ? quick : undefined} />
    <SequentialCheckTable kind="physical" items={attempt.physicalItems} editable={editable} onChange={physicalItems => change({ physicalItems, physicalRevealed: physicalItems.some(item => !!item.result) })} renderName={(item, index, update, disabled) => <div className="autocomplete-field"><input type="text" value={item.label} onChange={event => update(event.target.value)} disabled={disabled} placeholder="输入具体检查项目" aria-label={`体格检查 ${index + 1} 项目`} autoComplete="off" /></div>} />
    <p className="check-scoring-note">{policy.physicalOrderScoringEnabled ? "检查顺序计入评价" : "检查顺序仅记录"}</p>
    <DiagnosisNameEditor title="诊断修正" entries={attempt.physicalDiagnoses} previous={attempt.historyDiagnoses} disabled={!editable} onChange={physicalDiagnoses => change({ physicalDiagnoses })} />
    <div className="stage-submit-bar compact"><div><strong>本阶段输出</strong><span>{filled.length} 项检查 · {filled.filter(item => item.result && item.interpretation.trim()).length} 项已分析</span></div><button className="primary-button" disabled={!editable || !ready} onClick={onSubmit}>提交体查与诊断修正 →</button></div>
  </>;
}

function AuxiliaryStage({ attempt, policy, editable, change, onSubmit }: {
  attempt: Attempt; policy: Exam["policy"]; editable: boolean; change: (partial: Partial<Attempt>) => void; onSubmit: () => void;
}) {
  const quick = () => change({
    auxiliaryItems: [
      ["NT-proBNP", "1020 pg/ml，高于参考范围，支持心衰。"],
      ["胸部X线", "心影增大、肺淤血及双侧胸腔积液。"],
      ["动脉血气分析", "PaO₂ 59 mmHg，存在低氧血症。"],
      ["心电图", "窦性心律，侧壁导联T波低平。"],
      ["血生化", "肌酐和糖化血红蛋白升高，需结合肾功能及糖尿病。"],
    ].map(([label, interpretation], index) => ({ id: `af${index}`, label, interpretation, result: fixedCheckResult("auxiliary", label), generatedAt: new Date().toISOString() })), auxiliaryRevealed: true,
  });
  const filled = attempt.auxiliaryItems.filter(item => item.label.trim());
  const ready = filled.length > 0 && !duplicateChecks(filled) && filled.every(item => item.result && item.result.kind !== "clarification" && item.interpretation.trim()) && attempt.auxiliaryItems.every(item => item.label.trim());
  return <>
    <StageHeading number="03" title="辅助检查" quickFill={editable ? quick : undefined} />
    <SequentialCheckTable kind="auxiliary" items={attempt.auxiliaryItems} editable={editable} onChange={auxiliaryItems => change({ auxiliaryItems, auxiliaryRevealed: auxiliaryItems.some(item => !!item.result) })} renderName={(item, index, update, disabled) => <div className="autocomplete-field"><input type="text" value={item.label} onChange={event => update(event.target.value)} disabled={disabled} placeholder="输入具体检查项目" aria-label={`辅助检查 ${index + 1} 项目`} autoComplete="off" /></div>} />
    <p className="check-scoring-note">{policy.auxiliaryOrderScoringEnabled ? "检查顺序计入评价" : "检查顺序仅记录"}</p>
    <div className="stage-submit-bar compact"><div><strong>本阶段输出</strong><span>{filled.length} 项检查 · {filled.filter(item => item.result && item.interpretation.trim()).length} 项已分析</span></div><button className="primary-button" disabled={!editable || !ready} onClick={onSubmit}>提交本阶段，进入诊断与诊疗计划 →</button></div>
  </>;
}

function diagnosisVoiceText(
  name: string,
): string {
  if (name.includes("心力衰竭") || name.includes("心衰"))
    return "既往冠心病和心梗支架史，逐渐加重的劳力性呼吸困难、夜间平卧加重及双踝水肿；颈静脉怒张、肺底湿啰音，NT-proBNP 1020 pg/ml，胸片提示肺淤血。";
  if (name.includes("间质性肺病"))
    return "慢性咳嗽及进行性呼吸困难可作为鉴别，但容量负荷与心源性证据更突出。";
  return "结合病史、体格检查与辅助检查解释该诊断的支持依据。";
}

function VoiceEvidenceField({ label, value, onChange, diagnosisName, disabled }: {
  label: string; value: string; onChange: (value: string) => void; diagnosisName: string; disabled?: boolean;
}) {
  const id = useId();
  return <div className="voice-evidence-field"><label htmlFor={id}>{label}</label>
    <textarea id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={`填写${label}…`} />
    <div className="voice-evidence-actions">
      <SpeechInput label={label} value={value} onChange={onChange} disabled={disabled} />
      <button type="button" className="voice-evidence-button" disabled={disabled} onClick={() => { if (!value || window.confirm("用示例替换当前内容？")) onChange(diagnosisVoiceText(diagnosisName)); }}>填入示例</button>
    </div>
  </div>;
}

function FurtherPlanVoiceField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId();
  return <div className="voice-evidence-field"><label htmlFor={id}>进一步诊疗计划</label><textarea id={id} value={value} onChange={e => onChange(e.target.value)} placeholder="填写后续监测、会诊与检查安排…" /><SpeechInput label="进一步诊疗计划" value={value} onChange={onChange} disabled={disabled} /></div>;
}

function FinalStage({
  attempt,
  editable,
  change,
  updateAttempt,
  onSubmit,
}: {
  attempt: Attempt;
  editable: boolean;
  change: (partial: Partial<Attempt>) => void;
  updateAttempt: (updater: (a: Attempt) => Attempt) => void;
  onSubmit: () => void;
}) {
  const quick = () => {
    if ((attempt.casePresentation || attempt.plan || attempt.treatment) && !window.confirm("用演示作答替换当前病例汇报、诊断和计划？")) return;
    updateAttempt((a) => ({
      ...a,
      finalDiagnoses: [
        {
          ...blankDiagnosis("final-heart-failure"),
          name: "急性失代偿性心力衰竭",
          isPrimary: true,
          support: diagnosisVoiceText("急性失代偿性心力衰竭"),
        },
        {
          ...blankDiagnosis("final-ild"),
          name: "间质性肺病",
          support: diagnosisVoiceText("间质性肺病"),
        },
        {
          ...blankDiagnosis("final-copd"),
          name: "慢性阻塞性肺疾病IV级",
          support: "慢性咳嗽与呼吸困难列入鉴别诊断。",
        },
      ],
      casePresentation: "58岁女性，有冠心病、心梗支架和高血压病史，反复咳嗽及劳力性呼吸困难4年，近3个月加重，伴低氧血症、夜间平卧加重及双踝水肿。查体可见颈静脉怒张、双肺底湿啰音，NT-proBNP升高，胸片提示肺淤血。考虑急性失代偿性心力衰竭。",
      plan: "监测生命体征、血氧和出入量，评估容量状态及肾功能。",
      treatment:
        "限制钠盐及液体摄入，给予氧疗和利尿剂；评估螺内酯、SGLT2抑制剂、β受体阻滞剂及ACEI/ARB/ARNI的适用性。",
    }));
  };
  const updateDiagnosis = (
    index: number,
    partial: Partial<DiagnosisEntry>,
  ) =>
    change({
      finalDiagnoses: attempt.finalDiagnoses.map((diagnosis, itemIndex) =>
        itemIndex === index ? { ...diagnosis, ...partial } : diagnosis,
      ),
    });
  const filledDiagnoses = attempt.finalDiagnoses.filter((item) =>
    item.name.trim(),
  );
  const ready = Boolean(
    filledDiagnoses.length &&
      filledDiagnoses.some((item) => item.isPrimary) &&
      filledDiagnoses.every((item) => item.support.trim()) &&
      attempt.casePresentation.trim() &&
      attempt.plan.trim() &&
      attempt.treatment.trim(),
  );
  return (
    <fieldset className="review-fieldset" disabled={!editable}>
      <StageHeading
        number="04"
        title="病例汇报与诊疗计划"
        quickFill={quick}
      />
      {!ready && editable && <p className="submission-hint">提交前请完成病例汇报、至少一项主要诊断、每项诊断的支持点、诊疗计划及治疗方案。</p>}
      <div className="final-layout">
        <section className="final-form">
          <div className="form-section case-presentation-section">
            <div className="form-section-head"><span>01</span><div><h2>病例汇报</h2><p>概括病史与检查发现，随后完成诊断及计划，最后统一提交。</p></div></div>
            <label>病例汇报原文<textarea value={attempt.casePresentation} onChange={(event) => change({ casePresentation: event.target.value })} placeholder="概括病史、体征和检查发现，报告最终诊断及依据…" rows={8} /></label>
            <SpeechInput label="病例汇报" value={attempt.casePresentation} onChange={casePresentation => change({ casePresentation })} disabled={!editable} />
          </div>
          <div className="form-section diagnosis-final-section">
            <div className="form-section-head">
              <span>02</span>
              <div>
                <h2>诊断与依据</h2>
              </div>
            </div>
            {attempt.finalDiagnoses.map((diagnosis, index) => (
              <div
                className={`diagnosis-block ${diagnosis.isPrimary ? "primary" : ""}`}
                key={diagnosis.id}
              >
                <div className="diagnosis-title">
                  <b>诊断 {index + 1}</b>
                  <div>
                    <button
                      type="button"
                      className={`diagnosis-primary-toggle ${diagnosis.isPrimary ? "active" : ""}`}
                      aria-pressed={diagnosis.isPrimary}
                      onClick={() =>
                        updateDiagnosis(index, {
                          isPrimary: !diagnosis.isPrimary,
                        })
                      }
                    >
                      <i aria-hidden="true"></i>
                      {diagnosis.isPrimary ? "主要诊断" : "设为主要诊断"}
                    </button>
                    {attempt.finalDiagnoses.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          change({
                            finalDiagnoses: attempt.finalDiagnoses.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          })
                        }
                      >
                        删除
                      </button>
                    ) : null}
                  </div>
                </div>
                <AutocompleteInput
                  value={diagnosis.name}
                  onChange={(name) => updateDiagnosis(index, { name })}
                  library={diagnosisLibrary}
              remote="diagnosis"
                  label={`诊断 ${index + 1} 名称`}
                  placeholder="输入诊断关键词"
                />
                <SpeechInput label={`诊断 ${index + 1} 名称`} value={diagnosis.name} onChange={name => updateDiagnosis(index, { name })} disabled={!editable} />
                <div className="diagnosis-evidence-grid">
                  <VoiceEvidenceField
                    disabled={!editable}
                    label="支持点"
                    value={diagnosis.support}
                    diagnosisName={diagnosis.name}
                    onChange={(support) => updateDiagnosis(index, { support })}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              className="add-row-button block"
              onClick={() =>
                change({
                  finalDiagnoses: [
                    ...attempt.finalDiagnoses,
                    blankDiagnosis(`final-${Date.now()}`),
                  ],
                })
              }
            >
              ＋ 添加诊断
            </button>
          </div>
          <div className="form-section">
            <div className="form-section-head">
              <span>03</span>
              <div>
                <h2>进一步诊疗计划</h2>
              </div>
            </div>
            <FurtherPlanVoiceField
              disabled={!editable}
              value={attempt.plan}
              onChange={(plan) => change({ plan })}
            />
            <label>
              初步治疗方案
              <textarea
                value={attempt.treatment}
                onChange={(e) => change({ treatment: e.target.value })}
                placeholder="填写初步处置与治疗方案…"
              />
            </label>
            <SpeechInput label="初步治疗方案" value={attempt.treatment} onChange={treatment => change({ treatment })} disabled={!editable} />
          </div>
        </section>
        <aside className="final-side">
          <div className="completion-card">
            <h3>提交前检查</h3>
            {[
              ["诊断名称", filledDiagnoses.length > 0],
              ["主要诊断", filledDiagnoses.some((d) => d.isPrimary)],
              [
                "诊断支持点",
                filledDiagnoses.length > 0 &&
                  filledDiagnoses.every((d) => d.support),
              ],
              ["病例汇报", attempt.casePresentation],
              ["诊疗计划", attempt.plan && attempt.treatment],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <span>{value ? "✓" : "○"}</span>
                <b>{label}</b>
              </div>
            ))}
          </div>
        </aside>
      </div>
      <div className="stage-submit-bar compact final">
        <div>
          <strong>最终提交后不可修改</strong>
          <span>请确认全部作答</span>
        </div>
        <button className="primary-button" disabled={!ready} onClick={onSubmit}>
          确认并提交整场考试
        </button>
      </div>
    </fieldset>
  );
}
