"use client";
/* eslint-disable @next/next/no-img-element */
import { Fragment } from "react";
import type { CaseCheck, CaseImage } from "./teacher-store";

// Preview only: render a small Markdown subset as React nodes. Never interpret raw HTML.
function inline(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .map((s, i) =>
      s.startsWith("**") ? (
        <strong key={i}>{s.slice(2, -2)}</strong>
      ) : s.startsWith("`") ? (
        <code key={i}>{s.slice(1, -1)}</code>
      ) : (
        <Fragment key={i}>{s}</Fragment>
      ),
    );
}
function MarkdownPreview({ text }: { text: string }) {
  const lines = text.split(/\r?\n/),
    nodes = [];
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((s) => s.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (
      line.includes("|") &&
      lines[i + 1] &&
      /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])
    ) {
      const headers = cells(line),
        rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|"))
        rows.push(cells(lines[i++]));
      i--;
      nodes.push(
        <div className="t-md-table-wrap" key={i}>
          <table>
            <thead>
              <tr>
                {headers.map((h, j) => (
                  <th key={j}>{inline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, j) => (
                <tr key={j}>
                  {headers.map((_, k) => (
                    <td key={k}>{inline(row[k] || "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (/^#{1,6}\s/.test(line))
      nodes.push(<h4 key={i}>{inline(line.replace(/^#{1,6}\s+/, ""))}</h4>);
    else if (/^\s*[-*+]\s/.test(line))
      nodes.push(
        <p className="t-md-list" key={i}>
          • {inline(line.replace(/^\s*[-*+]\s+/, ""))}
        </p>,
      );
    else nodes.push(<p key={i}>{inline(line)}</p>);
  }
  return <div className="t-markdown-preview">{nodes}</div>;
}
export function CheckResultPreview({
  check,
  openImage,
}: {
  check: CaseCheck;
  openImage?: (image: CaseImage) => void;
}) {
  if (check.resultFormat === "image")
    return (
      <div className="t-check-preview-images">
        {check.resultImages?.length ? (
          check.resultImages.map((im, i) =>
            openImage ? (
              <button
                type="button"
                key={i}
                onClick={() => openImage(im)}
                aria-label={`查看${im.name}`}
              >
                <img src={im.src} alt={im.name} />
              </button>
            ) : (
              <img key={i} src={im.src} alt={im.name} />
            ),
          )
        ) : (
          <span className="t-preview-empty">上传图片后在此预览</span>
        )}
        {check.result && <p>{check.result}</p>}
      </div>
    );
  if (!check.result.trim())
    return <span className="t-preview-empty">输入结果后在此预览</span>;
  return check.resultFormat === "markdown" ? (
    <MarkdownPreview text={check.result} />
  ) : (
    <div className="t-plain-result">
      {check.result}
      {check.unit && ` ${check.unit}`}
    </div>
  );
}

export function CheckResultsEditor({
  checks,
  change,
  busy,
  upload,
}: {
  checks: CaseCheck[];
  change: (checks: CaseCheck[]) => void;
  busy: boolean;
  upload: (index: number, file?: File) => void;
}) {
  const patch = (index: number, value: Partial<CaseCheck>) =>
    change(checks.map((c, i) => (i === index ? { ...c, ...value } : c)));
  return (
    <fieldset disabled={busy} className="t-checks-fieldset">
      <div className="t-editor-row-head">
        <h3>检查结果</h3>
        <button
          type="button"
          className="link-button"
          onClick={() =>
            change([
              ...checks,
              { kind: "体格检查", name: "", result: "", resultFormat: "text" },
            ])
          }
        >
          ＋ 添加检查项目
        </button>
      </div>
      <div className="t-table-wrap t-checks-table-wrap">
        <table className="t-table t-checks-edit-table">
          <thead>
            <tr>
              <th>检查项目</th>
              <th>检查结果</th>
              <th>预览</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c, index) => (
              <tr key={index}>
                <td data-label="检查项目">
                  <label className="t-sr-only" htmlFor={`check-name-${index}`}>
                    检查项目{index + 1}
                  </label>
                  <input
                    id={`check-name-${index}`}
                    value={c.name}
                    placeholder="项目名称"
                    maxLength={120}
                    onChange={(e) => patch(index, { name: e.target.value })}
                  />
                  <select
                    aria-label={`检查类别${index + 1}`}
                    value={c.kind || "未分类"}
                    onChange={(e) => patch(index, { kind: e.target.value })}
                  >
                    {[
                      "未分类",
                      "体格检查",
                      "实验室检查",
                      "影像检查",
                      "其他辅助检查",
                    ].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                  <details className="t-check-options">
                    <summary>单位、范围与判读</summary>
                    <label>
                      单位
                      <input
                        value={c.unit || ""}
                        onChange={(e) => patch(index, { unit: e.target.value })}
                      />
                    </label>
                    <label>
                      参考范围
                      <input
                        value={c.reference || ""}
                        onChange={(e) =>
                          patch(index, { reference: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      图表参考下限
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={c.low ?? ""}
                        onChange={(e) =>
                          patch(index, {
                            low:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      图表参考上限
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={c.high ?? ""}
                        onChange={(e) =>
                          patch(index, {
                            high:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      参考判读
                      <textarea
                        rows={2}
                        aria-label={`参考判读${index + 1}`}
                        value={c.interpretation || ""}
                        onChange={(e) =>
                          patch(index, { interpretation: e.target.value })
                        }
                      />
                    </label>
                  </details>
                </td>
                <td data-label="检查结果">
                  <select
                    aria-label={`结果格式${index + 1}`}
                    value={c.resultFormat || "text"}
                    onChange={(e) =>
                      patch(index, {
                        resultFormat: e.target
                          .value as CaseCheck["resultFormat"],
                      })
                    }
                  >
                    <option value="text">粘贴文本</option>
                    <option value="markdown">Markdown</option>
                    <option value="image">上传图片</option>
                  </select>
                  {c.resultFormat === "image" ? (
                    <>
                      <label className="t-image-upload-button">
                        {busy ? "正在读取…" : "选择结果图片"}
                        <input
                          className="t-sr-only"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          aria-label={`上传结果图片${index + 1}`}
                          onChange={(e) => {
                            upload(index, e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {(c.resultImages || []).map((im, i) => (
                        <div className="t-check-image-name" key={i}>
                          <input
                            aria-label={`项目${index + 1}图片名称${i + 1}`}
                            value={im.name}
                            onChange={(e) =>
                              patch(index, {
                                resultImages: c.resultImages!.map((image, j) =>
                                  i === j
                                    ? { ...image, name: e.target.value }
                                    : image,
                                ),
                              })
                            }
                          />
                          <button
                            type="button"
                            className="link-button t-danger"
                            aria-label={`移除项目${index + 1}图片${i + 1}`}
                            onClick={() =>
                              patch(index, {
                                resultImages: c.resultImages!.filter(
                                  (_, j) => i !== j,
                                ),
                              })
                            }
                          >
                            移除
                          </button>
                        </div>
                      ))}
                      <textarea
                        rows={2}
                        aria-label={`结果文字${index + 1}`}
                        placeholder="图片说明（可选）"
                        value={c.result}
                        maxLength={5000}
                        onChange={(e) =>
                          patch(index, { result: e.target.value })
                        }
                      />
                    </>
                  ) : (
                    <textarea
                      aria-label={`结果文字${index + 1}`}
                      rows={5}
                      maxLength={5000}
                      placeholder={
                        c.resultFormat === "markdown"
                          ? "粘贴 Markdown，可包含标题、表格或列表"
                          : "粘贴检查报告或输入客观结果"
                      }
                      value={c.result}
                      onChange={(e) => patch(index, { result: e.target.value })}
                    />
                  )}
                </td>
                <td data-label="预览">
                  <div
                    className="t-check-live-preview"
                    role="region"
                    aria-label={`检查结果预览${index + 1}`}
                  >
                    <CheckResultPreview check={c} />
                  </div>
                </td>
                <td data-label="操作">
                  <button
                    type="button"
                    className="link-button t-danger"
                    aria-label={`删除检查${index + 1}`}
                    onClick={() => change(checks.filter((_, i) => i !== index))}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {checks.length === 0 && (
          <div className="t-checks-empty">
            暂无检查项目，点击“添加检查项目”开始录入。
          </div>
        )}
      </div>
    </fieldset>
  );
}
