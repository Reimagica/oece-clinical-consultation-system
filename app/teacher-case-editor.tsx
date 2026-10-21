"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import {
  readScoringFile,
  type TeachingCase,
  type CaseReference,
} from "./teacher-store";
import {
  caseFieldGroups,
  patientSummary,
  historyText,
  upgradeCase,
  scoringTemplate,
  type CaseSection,
} from "./teacher-case-schema";
import { TeacherDialog, TeacherTabs, downloadJSON } from "./teacher-ui";
import { CheckResultsEditor } from "./teacher-check-results";
import { PatientMediaEditor } from "./teacher-patient-media-editor";

const tabs = ["患者与病历", "形象与声线", "检查资料", "评分标准"];
export function CaseEditor({
  original,
  save,
  close,
  initialTab,
}: {
  original: TeachingCase;
  save: (record: TeachingCase) => boolean;
  close: () => void;
  initialTab?: "患者与病历" | "形象与声线";
}) {
  const [value, setValue] = useState(() =>
    structuredClone(upgradeCase(original)),
  );
  const [tab, setTab] = useState(initialTab || tabs[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    caseCode: string;
    references: CaseReference[];
  } | null>(null);
  const operation = useRef(0);
  const cancel = () => {
    operation.current++;
    close();
  };
  const update = (patch: Partial<TeachingCase>) =>
    setValue((v) => ({ ...v, ...patch }));
  const setField = (section: CaseSection, key: string, text: string) =>
    setValue((v) => ({
      ...v,
      details: {
        ...v.details!,
        [section]: { ...v.details![section], [key]: text },
      },
    }));
  const setReference = (index: number, patch: Partial<CaseReference>) =>
    update({
      references: value.references.map((r, i) =>
        i === index ? { ...r, ...patch } : r,
      ),
    });
  const itemChange = (
    index: number,
    i: number,
    patch: Partial<CaseReference["items"][number]>,
  ) =>
    setReference(index, {
      items: value.references[index].items.map((item, j) =>
        i === j ? { ...item, ...patch } : item,
      ),
    });
  const submit = () => {
    const patient = patientSummary(value.details!, value.patient).trim();
    if (
      !value.name.trim() ||
      !value.department.trim() ||
      !patient ||
      !value.overview.trim()
    ) {
      setError("请补全病例名称、科室、姓名或患者简述，以及主诉。");
      setTab(tabs[0]);
      return;
    }
    if (
      value.checks.some(
        (c) =>
          !c.name.trim() ||
          (c.resultFormat === "image"
            ? !c.resultImages?.length
            : !c.result.trim()) ||
          (c.high !== undefined &&
            (!Number.isFinite(c.high) || c.high <= (c.low ?? 0))) ||
          (c.low !== undefined && (!Number.isFinite(c.low) || c.low < 0)),
      )
    ) {
      setError("请补全检查名称和结果；图表参考上限需大于下限，或清空上下限。");
      setTab(tabs[2]);
      return;
    }
    if (
      value.references.some(
        (r) =>
          !r.title.trim() ||
          r.items.some(
            (i) =>
              !i.label.trim() ||
              !i.answer.trim() ||
              !Number.isFinite(i.points) ||
              i.points < 0 ||
              i.points > 1000,
          ),
      )
    ) {
      setError(
        "请补全小分项目与参考答案，分值需为0至1000的数字；不需要的空行可删除。",
      );
      setTab(tabs[3]);
      return;
    }
    if (pending) {
      setError("请先确认或取消待导入的评分标准。");
      setTab(tabs[3]);
      return;
    }
    const record = {
      ...value,
      schemaVersion: 2 as const,
      patient,
      history: historyText(value.details!),
      name: value.name.trim(),
      department: value.department.trim(),
      checks: value.checks.map((c) => ({
        ...c,
        value:
          c.high !== undefined &&
          c.result.trim() &&
          Number.isFinite(Number(c.result)) &&
          Number(c.result) >= 0
            ? Number(c.result)
            : undefined,
      })),
      references: value.references.map((r) => ({
        ...r,
        maximum:
          r.maximum === null ? null : r.items.reduce((n, i) => n + i.points, 0),
      })),
    };
    setError(
      save(record) ? "" : "保存失败，请减少图片或检查浏览器存储后重试。",
    );
  };
  const readScore = async (file?: File) => {
    if (!file) return;
    const id = ++operation.current;
    setBusy(true);
    setError("");
    try {
      const data = await readScoringFile(file);
      if (id === operation.current) setPending(data);
    } catch (e) {
      if (id === operation.current)
        setError(e instanceof Error ? e.message : "评分文件读取失败。");
    } finally {
      if (id === operation.current) setBusy(false);
    }
  };
  const readImage = async (index: number, file?: File) => {
    if (!file) return;
    if (
      !/^image\/(png|jpeg|webp)$/.test(file.type) ||
      file.size > 1024 * 1024 ||
      value.images.length +
        value.checks.reduce((n, c) => n + (c.resultImages?.length || 0), 0) >=
        3
    ) {
      setError("支持1MB以内PNG/JPG/WebP，最多3张。");
      return;
    }
    const id = ++operation.current;
    setBusy(true);
    setError("");
    try {
      const src = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const image = new Image();
      image.src = src;
      await image.decode();
      if (id === operation.current)
        setValue((v) => ({
          ...v,
          checks: v.checks.map((c, i) =>
            i === index
              ? {
                  ...c,
                  resultImages: [
                    ...(c.resultImages || []),
                    { name: file.name, src, usage: c.name },
                  ],
                }
              : c,
          ),
        }));
    } catch {
      if (id === operation.current) setError("图片无法读取，请检查文件格式。");
    } finally {
      if (id === operation.current) setBusy(false);
    }
  };
  return (
    <TeacherDialog
      title={original.name ? "编辑病例" : "新建病例"}
      close={cancel}
      wide
    >
      <TeacherTabs
        options={tabs}
        value={tab}
        change={(next) => {
          if (!busy) setTab(next);
        }}
        label="编辑病例内容"
      />
      <div className="t-dialog-body t-editor-body">
        {value.builtin && (
          <p className="t-note t-edit-scope">
            修改保存至教师病例库；学生固定Demo继续使用原演示资料。
          </p>
        )}
        {tab === tabs[0] && (
          <>
            <div className="t-form-grid">
              <label className="span-2">
                病例名称
                <input
                  maxLength={120}
                  value={value.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              <label>
                病例编号
                <input
                  maxLength={120}
                  value={value.caseCode || ""}
                  onChange={(e) => update({ caseCode: e.target.value })}
                />
              </label>
              <label>
                科室
                <input
                  maxLength={80}
                  value={value.department}
                  onChange={(e) => update({ department: e.target.value })}
                />
              </label>
              <label>
                难度
                <select
                  aria-label="病例难度"
                  value={value.difficulty}
                  onChange={(e) => update({ difficulty: e.target.value })}
                >
                  {["基础", "中等", "进阶"].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label>
                患者简述
                <input
                  maxLength={160}
                  value={value.patient}
                  onChange={(e) => update({ patient: e.target.value })}
                />
                <small>未分项时填写；分项信息优先。</small>
              </label>
            </div>
            <label className="t-field">
              主诉
              <textarea
                aria-label="主诉"
                rows={2}
                value={value.overview}
                onChange={(e) => update({ overview: e.target.value })}
              />
            </label>
            {caseFieldGroups.map((g, index) => (
              <details
                className="t-edit-section"
                key={g.key}
                open={index < 2 ? true : undefined}
              >
                <summary>{g.title}</summary>
                <div
                  className={
                    g.key === "patientInfo"
                      ? "t-form-grid"
                      : "t-structured-fields"
                  }
                >
                  {g.fields.map(([key, label]) => (
                    <label key={key}>
                      {label}
                      {g.key === "patientInfo" ? (
                        <input
                          aria-label={label}
                          value={value.details![g.key][key]}
                          maxLength={500}
                          onChange={(e) => setField(g.key, key, e.target.value)}
                        />
                      ) : (
                        <textarea
                          rows={3}
                          aria-label={label}
                          value={value.details![g.key][key]}
                          maxLength={50000}
                          onChange={(e) => setField(g.key, key, e.target.value)}
                        />
                      )}
                    </label>
                  ))}
                </div>
              </details>
            ))}
            <details className="t-edit-section">
              <summary>来源资料</summary>
              <div className="t-structured-fields">
                <label>
                  来源名称
                  <input
                    value={value.sourceName || ""}
                    onChange={(e) => update({ sourceName: e.target.value })}
                    maxLength={500}
                  />
                </label>
                <label>
                  来源原文
                  <textarea
                    rows={5}
                    maxLength={100000}
                    aria-label="来源原文"
                    value={value.sourceText || ""}
                    onChange={(e) => update({ sourceText: e.target.value })}
                  />
                </label>
              </div>
            </details>
          </>
        )}
        {tab === tabs[1] && (
          <PatientMediaEditor
            media={value.media!}
            name={value.details!.patientInfo.name || value.patient}
            gender={value.details!.patientInfo.gender}
            age={value.details!.patientInfo.age}
            change={(media) => update({ media })}
            busy={busy}
            setBusy={setBusy}
            error={setError}
          />
        )}
        {tab === tabs[2] && (
          <>
            {/* TODO: Production AI recognition should turn pasted text/Markdown or uploaded images into structured results, with source references and teacher confirmation. Preserve original inputs, validate clinical values, and version the approved result. Demo only stores and previews manual inputs; do not simulate recognition or invoke a model. */}
            <CheckResultsEditor
              checks={value.checks}
              change={(checks) => update({ checks })}
              busy={busy}
              upload={(index, file) => {
                void readImage(index, file);
              }}
            />
            {value.images.length > 0 && (
              <section className="t-legacy-results">
                <h3>待关联的结果图片</h3>
                <div className="t-edit-images">
                  {value.images.map((im, index) => (
                    <div key={index}>
                      <img src={im.src} alt={im.name} />
                      <label>
                        图片名称
                        <input
                          value={im.name}
                          onChange={(e) =>
                            update({
                              images: value.images.map((x, i) =>
                                i === index
                                  ? { ...x, name: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <select
                        aria-label={`关联图片${index + 1}到检查项目`}
                        value=""
                        disabled={busy}
                        onChange={(e) => {
                          const target = Number(e.target.value);
                          if (e.target.value === "") return;
                          update({
                            images: value.images.filter((_, i) => i !== index),
                            checks: value.checks.map((c, i) =>
                              i === target
                                ? {
                                    ...c,
                                    resultFormat: "image",
                                    resultImages: [
                                      ...(c.resultImages || []),
                                      im,
                                    ],
                                  }
                                : c,
                            ),
                          });
                        }}
                      >
                        <option value="">选择对应检查项目</option>
                        {value.checks.map((c, i) => (
                          <option value={i} key={i}>
                            {c.name || `检查项目${i + 1}`}
                          </option>
                        ))}
                      </select>
                      <button
                        className="link-button t-danger"
                        onClick={() =>
                          update({
                            images: value.images.filter((_, i) => i !== index),
                          })
                        }
                      >
                        移除图片
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        {tab === tabs[3] && (
          <>
            <div className="t-editor-row-head t-wrap">
              <h3>评分维度与细项</h3>
              <div className="t-actions">
                <button
                  className="link-button"
                  onClick={() =>
                    downloadJSON(
                      "评分标准模板.json",
                      scoringTemplate(value.caseCode),
                    )
                  }
                >
                  下载评分模板
                </button>
                <label className="t-file-link">
                  导入评分标准
                  <input
                    type="file"
                    accept=".json"
                    disabled={busy}
                    aria-label="导入评分标准文件"
                    onChange={(e) => {
                      void readScore(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            {pending && (
              <div
                className="t-import-review"
                role="region"
                aria-label="评分导入预览"
              >
                <strong>
                  已读取 {pending.references.length} 个维度、
                  {pending.references.reduce(
                    (n, r) => n + r.items.length,
                    0,
                  )}{" "}
                  个细项
                </strong>
                {pending.caseCode &&
                  value.caseCode &&
                  pending.caseCode !== value.caseCode && (
                    <p role="alert">
                      病例编号不一致：文件为“{pending.caseCode}”，当前为“
                      {value.caseCode}”。请核对后再应用。
                    </p>
                  )}
                <p>应用后替换当前评分标准，保存病例后生效。</p>
                <div className="t-table-wrap">
                  <table className="t-table">
                    <thead>
                      <tr>
                        <th>维度</th>
                        <th>细项</th>
                        <th>满分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.references.map((r, i) => (
                        <tr key={i}>
                          <td>{r.title || "未填写名称"}</td>
                          <td>{r.items.length}</td>
                          <td>{r.maximum ?? "描述性"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="ghost-button"
                  onClick={() => setPending(null)}
                >
                  取消导入
                </button>{" "}
                <button
                  className="primary-button"
                  onClick={() => {
                    update({ references: pending.references });
                    setPending(null);
                    setError("");
                  }}
                >
                  确认替换评分标准
                </button>
              </div>
            )}
            {value.references.map((r, index) => (
              <details key={index} className="t-edit-section t-score-edit">
                <summary>
                  {r.title || "新评价维度"}
                  <span>
                    {r.maximum === null
                      ? "描述性反馈"
                      : `${r.items.reduce((n, i) => n + i.points, 0)} 分`}
                  </span>
                </summary>
                <div className="t-form-grid">
                  <label>
                    维度名称
                    <input
                      value={r.title}
                      onChange={(e) =>
                        setReference(index, { title: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    评价方式
                    <select
                      value={r.maximum === null ? "descriptive" : "scored"}
                      onChange={(e) =>
                        setReference(index, {
                          maximum: e.target.value === "descriptive" ? null : 0,
                        })
                      }
                    >
                      <option value="scored">计分（细项自动合计）</option>
                      <option value="descriptive">描述性评价</option>
                    </select>
                  </label>
                </div>
                <div className="t-table-wrap">
                  <table className="t-table t-score-edit-table">
                    <thead>
                      <tr>
                        <th>小分项目</th>
                        <th>参考答案</th>
                        <th>分值</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.items.map((entry, i) => (
                        <tr key={i}>
                          <td>
                            <input
                              aria-label={`维度${index + 1}要点${i + 1}`}
                              value={entry.label}
                              onChange={(e) =>
                                itemChange(index, i, { label: e.target.value })
                              }
                            />
                          </td>
                          <td>
                            <textarea
                              rows={2}
                              aria-label={`维度${index + 1}参考答案${i + 1}`}
                              value={entry.answer}
                              onChange={(e) =>
                                itemChange(index, i, { answer: e.target.value })
                              }
                            />
                            <details className="t-rule-extra">
                              <summary>给分规则与证据</summary>
                              <label>
                                细项分组
                                <input
                                  value={entry.group || ""}
                                  onChange={(e) =>
                                    itemChange(index, i, {
                                      group: e.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                评分说明
                                <textarea
                                  rows={2}
                                  aria-label="评分说明"
                                  value={entry.scoringNotes || ""}
                                  onChange={(e) =>
                                    itemChange(index, i, {
                                      scoringNotes: e.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                证据要求
                                <textarea
                                  rows={2}
                                  aria-label="证据要求"
                                  value={entry.evidenceRequirement || ""}
                                  onChange={(e) =>
                                    itemChange(index, i, {
                                      evidenceRequirement: e.target.value,
                                    })
                                  }
                                />
                              </label>
                            </details>
                          </td>
                          <td>
                            {r.maximum === null ? (
                              <span>—</span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                max="1000"
                                step="any"
                                aria-label={`维度${index + 1}分值${i + 1}`}
                                value={entry.points}
                                onChange={(e) =>
                                  itemChange(index, i, {
                                    points: Number(e.target.value),
                                  })
                                }
                              />
                            )}
                          </td>
                          <td>
                            <button
                              className="link-button t-danger"
                              aria-label={`删除维度${index + 1}细项${i + 1}`}
                              onClick={() =>
                                setReference(index, {
                                  items: r.items.filter((_, j) => j !== i),
                                })
                              }
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="t-editor-row-head">
                  <button
                    className="link-button"
                    onClick={() =>
                      setReference(index, {
                        items: [
                          ...r.items,
                          { label: "", answer: "", points: 0 },
                        ],
                      })
                    }
                  >
                    ＋ 添加小分项目
                  </button>
                  <button
                    className="link-button t-danger"
                    onClick={() =>
                      update({
                        references: value.references.filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  >
                    删除维度
                  </button>
                </div>
              </details>
            ))}
            <button
              className="link-button"
              onClick={() =>
                update({
                  references: [
                    ...value.references,
                    { title: "", maximum: 0, items: [] },
                  ],
                })
              }
            >
              ＋ 添加维度
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="t-error">
            {error}
          </p>
        )}
      </div>
      <footer>
        <button className="ghost-button" onClick={cancel}>
          取消
        </button>
        <button className="primary-button" disabled={busy} onClick={submit}>
          {busy ? "正在读取…" : "保存病例"}
        </button>
      </footer>
    </TeacherDialog>
  );
}
