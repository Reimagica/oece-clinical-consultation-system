"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import {
  blankCase,
  type TeachingCase,
  type CaseCheck,
  type CaseImage,
} from "./teacher-store";
import { TeacherDialog, TeacherTabs, downloadJSON } from "./teacher-ui";
import { CaseEditor } from "./teacher-case-editor";
import { CaseUpload } from "./teacher-case-upload";
import { PatientAvatar } from "./teacher-patient-media-editor";
import { normalizePatientMedia } from "./teacher-patient-media";
import { CheckResultPreview } from "./teacher-check-results";
import {
  patientTemplate,
  scoringTemplate,
  caseFieldGroups,
} from "./teacher-case-schema";

type CaseActions = {
  records: TeachingCase[];
  save: (record: TeachingCase) => boolean;
  remove: (id: string) => void;
  go: (path: string) => void;
};
const detailTabs = ["病例概况", "检查资料", "评价与参考答案"];

function scoreItemLabel(label: string, group?: string) {
  const prefix = group?.trim();
  return !prefix ||
    ["开始", "结束", "检查项目"].includes(prefix) ||
    label.startsWith(prefix)
    ? label
    : `${prefix}-${label}`;
}

export function CaseLibrary({ records, save, remove, go }: CaseActions) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [editor, setEditor] = useState<TeachingCase | null>(null);
  const [upload, setUpload] = useState(false);
  const departments = [
    ...new Set(records.map((c) => c.department).filter(Boolean)),
  ];
  const filtered = records.filter(
    (c) =>
      `${c.name} ${c.patient} ${c.overview} ${c.builtin ? "心衰" : ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (!department || c.department === department) &&
      (!difficulty || c.difficulty === difficulty),
  );
  const [templates, setTemplates] = useState(false);
  const template = () => setTemplates(true);
  return (
    <div className="t-page">
      <div className="t-heading">
        <h1>
          病例库 <span>{records.length}</span>
        </h1>
        <div className="t-actions">
          <button
            className="ghost-button"
            onClick={() => setEditor(blankCase())}
          >
            新建病例
          </button>
          <button className="primary-button" onClick={() => setUpload(true)}>
            上传病例
          </button>
        </div>
      </div>
      <div className="t-toolbar">
        <input
          aria-label="搜索病例"
          type="search"
          placeholder="搜索患者、病例或主诉"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="科室筛选"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option value="">全部科室</option>
          {departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          aria-label="难度筛选"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="">全部难度</option>
          {["基础", "中等", "进阶"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <button className="link-button" onClick={template}>
          下载模板
        </button>
      </div>
      <div className="t-table-wrap">
        <table className="t-table t-case-table">
          <thead>
            <tr>
              <th>病例</th>
              <th>患者简述</th>
              <th>科室</th>
              <th>难度</th>
              <th className="t-align-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="t-case-title-with-avatar">
                    <PatientAvatar
                      media={normalizePatientMedia(c.media, c.builtin)}
                      name={c.details?.patientInfo.name || c.patient}
                      decorative
                    />
                    <div>
                      <button
                        className="t-title-link"
                        title={c.name}
                        onClick={() => go(`/teacher/cases/${c.id}`)}
                      >
                        {c.name}
                      </button>
                    </div>
                  </div>
                </td>
                <td>
                  <strong className="t-patient-line">
                    {c.patient || "待补充患者信息"}
                  </strong>
                  <span className="t-cell-summary">
                    {c.overview || "待补充病例概况"}
                  </span>
                </td>
                <td>{c.department || "未设置"}</td>
                <td>
                  <span className="t-difficulty">{c.difficulty}</span>
                </td>
                <td>
                  <div className="t-row-actions">
                    <button onClick={() => go(`/teacher/cases/${c.id}`)}>
                      查看
                    </button>
                    <button onClick={() => setEditor(structuredClone(c))}>
                      编辑
                    </button>
                    <select
                      aria-label={`${c.name}更多操作`}
                      value=""
                      onChange={(e) => {
                        if (e.target.value === "copy")
                          setEditor({
                            ...structuredClone(c),
                            id: crypto.randomUUID(),
                            name: `${c.name}（副本）`,
                            builtin: false,
                          });
                        else if (e.target.value === "export")
                          downloadJSON(`${c.name}.json`, c);
                        else if (
                          e.target.value === "delete" &&
                          window.confirm(`删除病例“${c.name}”？`)
                        )
                          remove(c.id);
                      }}
                    >
                      <option value="">更多</option>
                      <option value="copy">复制病例</option>
                      <option value="export">导出病例</option>
                      {!c.builtin && <option value="delete">删除病例</option>}
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="t-empty">
            <p>{records.length ? "没有匹配的病例" : "还没有病例"}</p>
            <button
              className="link-button"
              onClick={() => {
                setQuery("");
                setDepartment("");
                setDifficulty("");
              }}
            >
              清除筛选
            </button>
          </div>
        )}
      </div>
      {templates && (
        <TeacherDialog title="下载病例模板" close={() => setTemplates(false)}>
          <div className="t-dialog-body t-template-options">
            <p className="t-note">
              患者资料与评分标准可分别准备；先上传患者资料，再在编辑页导入评分标准。
            </p>
            <button
              className="ghost-button"
              onClick={() =>
                downloadJSON("患者资料模板.json", patientTemplate())
              }
            >
              下载患者资料模板
            </button>
            <button
              className="ghost-button"
              onClick={() =>
                downloadJSON("评分标准模板.json", scoringTemplate())
              }
            >
              下载评分标准模板
            </button>
          </div>
        </TeacherDialog>
      )}
      {upload && (
        <CaseUpload
          close={() => setUpload(false)}
          ready={(record) => {
            setUpload(false);
            setEditor(record);
          }}
        />
      )}
      {editor && (
        <CaseEditor
          key={editor.id}
          original={editor}
          close={() => setEditor(null)}
          save={(record) => {
            const ok = save(record);
            if (ok) setEditor(null);
            return ok;
          }}
        />
      )}
    </div>
  );
}

export function CaseDetail({
  record,
  save,
  go,
}: {
  record: TeachingCase;
  save: CaseActions["save"];
  go: CaseActions["go"];
}) {
  const [tab, setTab] = useState(detailTabs[0]);
  const [editing, setEditing] = useState<"patient" | "media" | null>(null);
  const [image, setImage] = useState<CaseImage | null>(null);
  const chartedChecks = record.checks.filter(
    (c) =>
      c.resultFormat !== "image" &&
      c.value !== undefined &&
      Number.isFinite(Number(c.result)) &&
      c.high !== undefined,
  );
  const plainChecks = record.checks.filter((c) => !chartedChecks.includes(c));
  return (
    <div className="t-page">
      <button className="t-back" onClick={() => go("/teacher/cases")}>
        ← 病例库
      </button>
      <div className="t-heading t-entity-heading">
        <div>
          <h1>{record.name}</h1>
          <div className="t-meta">
            <span>{record.patient}</span>
            <span>{record.department}</span>
            <span>{record.difficulty}</span>
          </div>
        </div>
        <div className="t-actions">
          <button
            className="ghost-button"
            onClick={() => setEditing("patient")}
          >
            编辑病例
          </button>
          {record.builtin && (
            <button
              className="primary-button"
              onClick={() => go("/teacher/exams/new")}
            >
              用此病例建考
            </button>
          )}
        </div>
      </div>
      <TeacherTabs
        options={detailTabs}
        value={tab}
        change={setTab}
        label="病例内容"
      />
      <div className="t-detail-surface">
        {tab === detailTabs[0] && (
          <CaseOverview record={record} editMedia={() => setEditing("media")} />
        )}
        {tab === detailTabs[1] && (
          <>
            <div className="t-result-charts">
              {chartedChecks.map((c) => (
                <RangeChart key={record.checks.indexOf(c)} check={c} />
              ))}
            </div>
            {plainChecks.length > 0 && (
              <table className="t-table t-findings">
                <thead>
                  <tr>
                    <th>检查项目</th>
                    <th>结果</th>
                    <th>参考范围 / 判读</th>
                  </tr>
                </thead>
                <tbody>
                  {plainChecks.map((c, index) => (
                    <tr key={index}>
                      <th scope="row">{c.name}</th>
                      <td>
                        <CheckResultPreview check={c} openImage={setImage} />
                      </td>
                      <td>
                        {[c.reference, c.interpretation]
                          .filter(Boolean)
                          .join("；") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {record.checks.length === 0 && (
              <p className="t-note">尚未添加检查资料，可在编辑病例中补充。</p>
            )}
            <div className="t-image-strip">
              {record.images.map((item, index) => (
                <button key={index} onClick={() => setImage(item)}>
                  <img src={item.src} alt={item.name} />
                  <span>
                    {item.name}
                    {item.usage && <small>{item.usage}</small>}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        {tab === detailTabs[2] && (
          <div className="t-reference-list">
            {record.references.length ? (
              record.references.map((dimension, index) => (
                <details key={index}>
                  <summary>
                    <span>{dimension.title}</span>
                    <span>
                      {dimension.maximum === null
                        ? "描述性反馈"
                        : `${dimension.maximum} 分`}
                      <b>＋</b>
                    </span>
                  </summary>
                  <div className="t-table-wrap t-reference-items">
                    <table
                      className="t-table t-score-table"
                      aria-label={`${dimension.title}评分细项`}
                    >
                      <thead>
                        <tr>
                          <th>小分项目</th>
                          <th>参考答案</th>
                          <th>分值</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dimension.items.map((item, i) => (
                          <tr key={i}>
                            <th scope="row">
                              {scoreItemLabel(item.label, item.group)}
                            </th>
                            <td>{item.answer}</td>
                            <td>
                              {dimension.maximum === null ? "—" : item.points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))
            ) : (
              <p className="t-note">尚未添加评价维度与参考答案。</p>
            )}
          </div>
        )}
      </div>
      {editing && (
        <CaseEditor
          original={structuredClone(record)}
          initialTab={editing === "media" ? "形象与声线" : "患者与病历"}
          close={() => setEditing(null)}
          save={(item) => {
            const ok = save(item);
            if (ok) setEditing(null);
            return ok;
          }}
        />
      )}
      {image && (
        <TeacherDialog title={image.name} close={() => setImage(null)}>
          <div className="t-image-preview">
            <img src={image.src} alt={image.name} />
          </div>
        </TeacherDialog>
      )}
    </div>
  );
}

function CaseOverview({
  record,
  editMedia,
}: {
  record: TeachingCase;
  editMedia: () => void;
}) {
  const history = caseFieldGroups[1].fields.filter(
    ([key]) => record.details?.medicalHistory[key],
  );
  let primary = history.filter(([key]) =>
    ["presentIllness", "pastHistory"].includes(key),
  );
  if (!primary.length) primary = history.slice(0, 1);
  const extra = history.filter(([key]) => !primary.some(([k]) => k === key));
  const sideGroups = caseFieldGroups
    .slice(2)
    .filter((g) => g.fields.some(([key]) => record.details?.[g.key][key]));
  const historyRows = (fields: typeof history) => (
    <dl className="t-case-history-rows">
      {fields.map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{record.details!.medicalHistory[key]}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <div className="t-case-overview">
      <div className="t-case-profile-header">
        <button
          type="button"
          className="t-case-portrait"
          aria-label="编辑患者形象与声线"
          onClick={editMedia}
        >
          <PatientAvatar
            media={normalizePatientMedia(record.media, record.builtin)}
            name={record.details?.patientInfo.name || record.patient}
          />
          <span>编辑形象</span>
        </button>
        <div className="t-case-complaint">
          <h2>主诉</h2>
          <p>{record.overview || "尚未填写主诉"}</p>
        </div>
        {record.details && (
          <dl className="t-case-patient-line">
            {caseFieldGroups[0].fields
              .filter(([key]) => record.details!.patientInfo[key])
              .map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{record.details!.patientInfo[key]}</dd>
                </div>
              ))}
          </dl>
        )}
      </div>
      <div
        className={`t-case-overview-grid${sideGroups.length ? "" : " t-case-history-only"}`}
      >
        <section className="t-case-history-section">
          <h2>病史资料</h2>
          {primary.length ? (
            historyRows(primary)
          ) : record.history ? (
            <CaseHistory text={record.history} />
          ) : (
            <p>尚未填写病史资料。</p>
          )}
          {extra.length > 0 && (
            <details className="t-case-extra-history">
              <summary>其他病史</summary>
              {historyRows(extra)}
            </details>
          )}
        </section>
        {sideGroups.length > 0 && (
          <aside className="t-case-supporting">
            {sideGroups.map((g) => (
              <section className="t-case-side-section" key={g.key}>
                <h2>{g.title}</h2>
                <dl>
                  {g.fields
                    .filter(([key]) => record.details![g.key][key])
                    .map(([key, label]) => (
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd>{record.details![g.key][key]}</dd>
                      </div>
                    ))}
                </dl>
              </section>
            ))}
          </aside>
        )}
      </div>
      {(record.sourceName || record.sourceText) && (
        <details className="t-case-source">
          <summary>来源资料</summary>
          {record.sourceName && <p>{record.sourceName}</p>}
          {record.sourceText && <p>{record.sourceText}</p>}
        </details>
      )}
    </div>
  );
}

function CaseHistory({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/);
  const long = paragraphs[0].length > 600;
  const visible = long
    ? [paragraphs[0].slice(0, 420) + "…"]
    : paragraphs.slice(0, 2);
  const remainder = long ? paragraphs : paragraphs.slice(2);
  return (
    <div className="t-history">
      {visible.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {remainder.length > 0 && (
        <details className="t-history-more">
          <summary>{long ? "展开完整病历" : "其他病史"}</summary>
          {remainder.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </details>
      )}
    </div>
  );
}

function RangeChart({ check }: { check: CaseCheck }) {
  const numeric = Number(check.result);
  const max = Math.max(numeric, check.high!) * 1.15;
  const x = (n: number) => 12 + Math.min(n / max, 1) * 240;
  return (
    <div className="t-range-chart">
      <span>{check.name}</span>
      <strong>
        {check.result}
        <small> {check.unit}</small>
      </strong>
      <svg
        viewBox="0 0 264 36"
        role="img"
        aria-label={`${check.name}结果${check.result}${check.unit}，参考范围${check.reference}`}
      >
        <line
          x1="12"
          y1="18"
          x2="252"
          y2="18"
          stroke="#e5eaf2"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <line
          x1={x(check.low ?? 0)}
          y1="18"
          x2={x(check.high!)}
          y2="18"
          stroke="#b8c5d6"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <circle cx={x(numeric)} cy="18" r="6" fill="#2869ed" />
      </svg>
      <small>
        参考：{check.reference} {check.unit}
      </small>
      {check.interpretation && <p className="t-note">{check.interpretation}</p>}
    </div>
  );
}
