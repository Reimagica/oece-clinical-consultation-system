"use client";
import { useState } from "react";
import {
  caseFixture,
  type Attempt,
  type DemoState,
  type Exam,
} from "./demo-data";
import {
  defaultDimensionWeights,
  normalizeWeights,
  scoringDimensions,
} from "./score-policy";
import {
  newDraft,
  type TeachingCase,
  type ExamDraft,
  type ExamArchive,
} from "./teacher-store";
import { TeacherDialog } from "./teacher-ui";

type Navigation = { go: (path: string) => void };
const date = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Shanghai",
      }).format(new Date(value))
    : "—";
const status = (attempt: Attempt | null) =>
  attempt?.status === "submitted"
    ? "已完成"
    : attempt?.status === "in_progress"
      ? "进行中"
      : "已发布";

export function ExamList({
  state,
  drafts,
  archives,
  saveDraft,
  removeDraft,
  go,
}: Navigation & {
  state: DemoState;
  drafts: ExamDraft[];
  archives: ExamArchive[];
  saveDraft: (draft: ExamDraft) => boolean;
  removeDraft: (id: string) => void;
}) {
  const [filter, setFilter] = useState("all");
  const rows = [
    ...drafts.map((d) => ({
      id: d.id,
      title: d.title,
      label: "草稿",
      time: d.updatedAt,
      draft: d,
      archive: false,
      href: `/teacher/exams/draft/${d.id}`,
    })),
    ...(state.exam
      ? [
          {
            id: state.exam.id,
            title: state.exam.title,
            label: status(state.attempt),
            time: state.exam.publishedAt,
            draft: null,
            archive: false,
            href: `/teacher/exams/${state.exam.id}`,
          },
        ]
      : []),
    ...archives.map((a) => ({
      id: a.id,
      title: a.exam.title,
      label: "已归档",
      time: a.archivedAt,
      draft: null,
      archive: true,
      href: `/teacher/exams/archive/${a.id}`,
    })),
  ].filter(
    (row) =>
      filter === "all" ||
      (filter === "draft"
        ? row.draft
        : filter === "current"
          ? !row.draft && !row.archive
          : row.archive),
  );
  const copy = (exam: Exam) => {
    const d = {
      ...newDraft(),
      title: `${exam.title}（副本）`,
      policy: structuredClone(exam.policy),
    };
    if (saveDraft(d)) go(`/teacher/exams/draft/${d.id}`);
  };
  return (
    <div className="t-page">
      <div className="t-heading">
        <h1>考试管理</h1>
        <button
          className="primary-button"
          onClick={() => go("/teacher/exams/new")}
        >
          创建考试
        </button>
      </div>
      <div className="t-list-switch" role="group" aria-label="考试状态">
        {[
          ["all", "全部"],
          ["draft", "草稿"],
          ["current", "已发布"],
          ["archive", "已归档"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="t-table-wrap">
        <table className="t-table">
          <thead>
            <tr>
              <th>考试名称</th>
              <th>病例</th>
              <th>状态</th>
              <th>更新时间</th>
              <th className="t-align-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button className="t-title-link" onClick={() => go(row.href)}>
                    {row.title}
                  </button>
                  <small className="t-cell-summary">
                    OECE · 30分钟 · 1名演示学员
                  </small>
                </td>
                <td>郭曼 · 心力衰竭</td>
                <td>
                  <span className={`t-status ${row.draft ? "draft" : ""}`}>
                    {row.label}
                  </span>
                </td>
                <td className="t-date">{date(row.time)}</td>
                <td>
                  <div className="t-row-actions">
                    <button onClick={() => go(row.href)}>
                      {row.draft ? "编辑" : "查看"}
                    </button>
                    {row.draft ? (
                      <>
                        <button
                          onClick={() => {
                            const d = {
                              ...structuredClone(row.draft!),
                              id: newDraft().id,
                              title: `${row.title}（副本）`,
                              updatedAt: new Date().toISOString(),
                            };
                            saveDraft(d);
                          }}
                        >
                          复制
                        </button>
                        <button
                          className="t-danger"
                          onClick={() => {
                            if (window.confirm(`删除草稿“${row.title}”？`))
                              removeDraft(row.id);
                          }}
                        >
                          删除
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          const e = row.archive
                            ? archives.find((a) => a.id === row.id)?.exam
                            : state.exam;
                          if (e) copy(e);
                        }}
                      >
                        复制建考
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="t-empty">
            <h2>{filter === "all" ? "创建第一场考试" : "暂无考试"}</h2>
            <p>
              {filter === "all"
                ? "选择病例并确认设置，即可开始演示。"
                : "切换状态查看其他考试。"}
            </p>
            {filter === "all" && (
              <button
                className="primary-button"
                onClick={() => go("/teacher/exams/new")}
              >
                创建考试
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ExamBuilder({
  original,
  cases,
  save,
  publish,
  go,
}: Navigation & {
  original?: ExamDraft;
  cases: TeachingCase[];
  save: (draft: ExamDraft) => boolean;
  publish: (draft: ExamDraft) => "published" | "cancelled" | "failed";
}) {
  const [draft, setDraft] = useState<ExamDraft>(() =>
    original ? structuredClone(original) : newDraft(),
  );
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const weights = draft.policy.dimensionWeights ?? defaultDimensionWeights;
  const selected = cases.find((c) => c.id === draft.caseId && c.builtin);
  const weightValid =
    Object.values(weights).every(
      (w) => Number.isFinite(w) && w >= 0 && w <= 100,
    ) && Object.values(weights).some((w) => w > 0);
  const patchPolicy = (patch: Partial<Exam["policy"]>) =>
    setDraft((d) => ({ ...d, policy: { ...d.policy, ...patch } }));
  const valid = () => {
    if (!selected || draft.caseId !== caseFixture.id) {
      setError("请选择已接入学生演示的郭曼病例。");
      setStep(0);
      return false;
    }
    if (!draft.title.trim()) {
      setError("请输入考试名称。");
      setStep(1);
      return false;
    }
    if (!weightValid) {
      setError("评分权重须为0—100，且至少一项大于0。");
      setStep(1);
      return false;
    }
    setError("");
    return true;
  };
  const prepared = () => ({
    ...draft,
    title: draft.title.trim(),
    policy: { ...draft.policy, dimensionWeights: normalizeWeights(weights) },
    updatedAt: new Date().toISOString(),
  });
  return (
    <div className="t-page">
      <button className="t-back" onClick={() => go("/teacher/exams")}>
        ← 考试管理
      </button>
      <div className="t-heading">
        <h1>{original ? "编辑考试" : "创建考试"}</h1>
        <span className="t-note">OECE 临床思维</span>
      </div>
      <ol className="t-steps">
        {["选择病例", "考试设置", "确认发布"].map((label, index) => (
          <li
            key={label}
            className={step === index ? "active" : index < step ? "done" : ""}
          >
            <button
              disabled={index > step}
              aria-current={step === index ? "step" : undefined}
              onClick={() => setStep(index)}
            >
              <b>{index + 1}</b>
              {label}
            </button>
          </li>
        ))}
      </ol>
      <section className="t-builder-surface">
        {step === 0 && (
          <>
            <table className="t-table t-select-case">
              <thead>
                <tr>
                  <th>选择</th>
                  <th>病例</th>
                  <th>患者简述</th>
                  <th>科室</th>
                  <th>难度</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    className={draft.caseId === c.id ? "selected" : ""}
                  >
                    <td>
                      {c.builtin ? (
                        <input
                          aria-label={`选择${c.name}`}
                          type="radio"
                          name="case"
                          checked={draft.caseId === c.id}
                          onChange={() =>
                            setDraft((d) => ({ ...d, caseId: c.id }))
                          }
                        />
                      ) : (
                        <span className="t-note">仅展示</span>
                      )}
                    </td>
                    <td>{c.name}</td>
                    <td>{c.patient}</td>
                    <td>{c.department}</td>
                    <td>{c.difficulty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="t-note t-builder-note">
              当前演示仅郭曼病例接入学生考试。
            </p>
          </>
        )}
        {step === 1 && (
          <div className="t-builder-form">
            <div className="t-form-grid">
              <label className="span-2">
                考试名称
                <input
                  maxLength={120}
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, title: e.target.value }))
                  }
                />
              </label>
              <div className="t-read-field">
                <span>考试时长</span>
                <strong>30分钟</strong>
              </div>
              <div className="t-read-field">
                <span>参加学员</span>
                <strong>编号001演示学员</strong>
              </div>
            </div>
            <div className="t-rule-switches">
              <label>
                <input
                  type="checkbox"
                  checked={draft.policy.physicalOrderScoringEnabled}
                  onChange={(e) =>
                    patchPolicy({
                      physicalOrderScoringEnabled: e.target.checked,
                    })
                  }
                />
                体查顺序计分
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.policy.auxiliaryOrderScoringEnabled}
                  onChange={(e) =>
                    patchPolicy({
                      auxiliaryOrderScoringEnabled: e.target.checked,
                    })
                  }
                />
                辅检顺序计分
              </label>
            </div>
            <details className="t-advanced">
              <summary>调整评价权重</summary>
              <div className="t-weight-grid">
                {scoringDimensions.map((d) => (
                  <label key={d.id}>
                    {d.title}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={weights[d.id]}
                      onChange={(e) =>
                        patchPolicy({
                          dimensionWeights: {
                            ...weights,
                            [d.id]: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </details>
          </div>
        )}
        {step === 2 && (
          <div className="t-publish-review">
            <div className="t-review-case">
              <span className="t-review-icon">考</span>
              <div>
                <h2>{draft.title}</h2>
                <p>
                  {selected?.name} · {selected?.patient}
                </p>
              </div>
            </div>
            <dl>
              <div>
                <dt>考试形式</dt>
                <dd>OECE · 四阶段</dd>
              </div>
              <div>
                <dt>学员与时长</dt>
                <dd>编号001 · 30分钟</dd>
              </div>
              <div>
                <dt>患者问诊</dt>
                <dd>全程可用</dd>
              </div>
              <div>
                <dt>顺序计分</dt>
                <dd>
                  体查
                  {draft.policy.physicalOrderScoringEnabled ? "开启" : "关闭"} /
                  辅检
                  {draft.policy.auxiliaryOrderScoringEnabled ? "开启" : "关闭"}
                </dd>
              </div>
              <div>
                <dt>评价方案</dt>
                <dd>六维加权百分制 · 推理维度暂不计分</dd>
              </div>
            </dl>
          </div>
        )}
        {error && (
          <p className="t-error t-builder-note" role="alert">
            {error}
          </p>
        )}
        <footer className="t-builder-footer">
          <button
            className="link-button"
            onClick={() => {
              if (!valid()) return;
              if (save(prepared())) go("/teacher/exams");
              else setError("未能保存，请检查浏览器存储后重试。");
            }}
          >
            保存草稿
          </button>
          <div className="t-actions">
            {step > 0 && (
              <button
                className="ghost-button"
                onClick={() => setStep((s) => s - 1)}
              >
                上一步
              </button>
            )}
            {step < 2 ? (
              <button
                className="primary-button"
                onClick={() => {
                  if (valid()) setStep((s) => s + 1);
                }}
              >
                下一步
              </button>
            ) : (
              <button
                className="primary-button"
                onClick={() => {
                  if (!valid()) return;
                  const result = publish(prepared());
                  if (result === "failed")
                    setError("考试未发布；原考试已保留，请检查提示后重试。");
                  else if (result === "cancelled") setError("");
                }}
              >
                发布考试
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}

export function PublishedExam({
  exam,
  attempt,
  archived,
  go,
}: Navigation & { exam: Exam; attempt: Attempt | null; archived: boolean }) {
  const [preview, setPreview] = useState(false);
  return (
    <div className="t-page">
      <button className="t-back" onClick={() => go("/teacher/exams")}>
        ← 考试管理
      </button>
      <div className="t-heading t-entity-heading">
        <div>
          <h1>{exam.title}</h1>
          <div className="t-meta">
            <span className="t-status">
              {archived ? "已归档" : status(attempt)}
            </span>
            <span>郭曼 · 心力衰竭</span>
          </div>
        </div>
        <div className="t-actions">
          <button className="ghost-button" onClick={() => setPreview(true)}>
            预览任务
          </button>
          {!archived && (
            <button
              className="primary-button"
              onClick={() => go("/student/tasks")}
            >
              进入学生演示
            </button>
          )}
        </div>
      </div>
      <div className="t-detail-surface">
        <dl className="t-exam-facts">
          <div>
            <dt>考试类型</dt>
            <dd>OECE临床思维</dd>
          </div>
          <div>
            <dt>时长</dt>
            <dd>{exam.durationMinutes}分钟</dd>
          </div>
          <div>
            <dt>患者问诊</dt>
            <dd>全程可用</dd>
          </div>
        </dl>
        <h2 className="t-section-title">学员作答</h2>
        <table className="t-table">
          <thead>
            <tr>
              <th>学员</th>
              <th>状态</th>
              <th>进度</th>
              <th className="t-align-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{exam.studentName}</td>
              <td>
                {attempt?.status === "submitted"
                  ? "已提交"
                  : attempt?.status === "in_progress"
                    ? "进行中"
                    : "待开始"}
              </td>
              <td>{attempt?.completedStages.length ?? 0} / 4 阶段</td>
              <td className="t-align-right">
                {attempt?.status === "submitted" ? (
                  <button
                    className="link-button"
                    onClick={() => go(`/teacher/submissions/${attempt.id}`)}
                  >
                    查看评价
                  </button>
                ) : (
                  <span className="t-note">提交后查看评价</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {preview && (
        <TeacherDialog title="学员任务预览" close={() => setPreview(false)}>
          <div className="t-dialog-body">
            <h3>{exam.title}</h3>
            <p>郭曼，女性，58岁。反复咳嗽伴呼吸困难4年，加重3个月。</p>
            <ol className="t-task-preview">
              <li>病史采集与初步诊断</li>
              <li>体格检查与诊断修正</li>
              <li>辅助检查与结果分析</li>
              <li>病例汇报、诊断依据与诊疗方案</li>
            </ol>
            <p className="t-note">30分钟 · 提交后查看评价与证据</p>
          </div>
          <footer>
            <button
              className="primary-button"
              onClick={() => setPreview(false)}
            >
              完成预览
            </button>
          </footer>
        </TeacherDialog>
      )}
    </div>
  );
}
