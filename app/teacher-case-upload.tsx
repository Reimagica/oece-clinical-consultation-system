"use client";
import { useRef, useState } from "react";
import { blankCase, readCaseFile, type TeachingCase } from "./teacher-store";
import { patientTemplate, scoringTemplate } from "./teacher-case-schema";
import { agentImportPrompt } from "./teacher-agent-import";
import { TeacherDialog, TeacherTabs, downloadJSON } from "./teacher-ui";

const uploadMethods = ["Agent上传", "手动上传"] as const;

export function CaseUpload({ close, ready }: {
  close: () => void;
  ready: (record: TeachingCase) => void;
}) {
  const [method, setMethod] = useState<string>(uploadMethods[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [promptOpen, setPromptOpen] = useState(false);
  const [prompt] = useState(() => agentImportPrompt(window.location.origin));
  const operation = useRef(0);
  const cancel = () => {
    operation.current++;
    close();
  };
  const changeMethod = (value: string) => {
    operation.current++;
    setBusy(false);
    setError("");
    setCopyStatus("");
    setMethod(value);
  };
  const copyPrompt = async () => {
    const request = operation.current;
    try {
      await navigator.clipboard.writeText(prompt);
      if (request === operation.current) setCopyStatus("提示词已复制，可发给你的Agent。");
    } catch {
      if (request !== operation.current) return;
      setPromptOpen(true);
      setCopyStatus("复制受限，请在下方提示词中全选复制。");
    }
  };
  const read = async (file?: File) => {
    if (!file) return;
    const request = ++operation.current;
    setBusy(true);
    setError("");
    try {
      const record = await readCaseFile(file);
      if (request === operation.current) ready(record);
    } catch (e) {
      if (request === operation.current)
        setError(e instanceof Error ? e.message : "文件读取失败，请重试。");
    } finally {
      if (request === operation.current) setBusy(false);
    }
  };
  return (
    <TeacherDialog title="上传病例" close={cancel}>
      <TeacherTabs options={uploadMethods} value={method} change={changeMethod} label="病例上传方式" />
      {method === uploadMethods[0] ? (
        <div className="t-dialog-body t-agent-upload">
          <div className="t-agent-upload-heading">
            <h3>使用你自己的Agent</h3>
            <span className="t-agent-status">MCP尚未开放</span>
          </div>
          <p>由你的Agent协助整理病例与评分标准。MCP开放后，核对即可直接上传。</p>
          <ol className="t-agent-steps">
            <li>复制提示词，发给你的Agent</li>
            <li>提供资料，核对病例与评分标准</li>
            <li>当前先导出文件，再手动导入</li>
          </ol>
          <div className="t-actions t-agent-upload-actions">
            <button className="primary-button" onClick={() => void copyPrompt()}>复制提示词</button>
            <button className="ghost-button" onClick={() => changeMethod(uploadMethods[1])}>手动导入结果</button>
          </div>
          <p className="t-copy-status" role="status">{copyStatus}</p>
          <details className="t-agent-prompt" open={promptOpen} onToggle={(event) => setPromptOpen(event.currentTarget.open)}>
            <summary>查看提示词</summary>
            <textarea aria-label="Agent病例上传提示词" value={prompt} readOnly rows={9} spellCheck={false} />
          </details>
        </div>
      ) : (
        <div className="t-dialog-body t-manual-upload">
          <label className="t-upload-area">
            <span>{busy ? "正在读取文件…" : "选择病例资料"}</span>
            <span className="t-upload-formats">Word · TXT · Markdown · JSON，最大4MB</span>
            <input aria-label="上传病例文件" type="file" accept=".docx,.txt,.md,.json" disabled={busy}
              onChange={(event) => {
                void read(event.target.files?.[0]);
                event.target.value = "";
              }} />
          </label>
          <p>读取后先核对内容，保存后加入病例库。评分标准可在编辑页单独导入。</p>
          {error && <p role="alert" className="t-error">{error}</p>}
          <div className="t-manual-create"><span>没有现成文件？</span><button className="link-button" onClick={() => { operation.current++; ready(blankCase()); }}>手动录入</button></div>
          <div className="t-actions t-upload-templates">
            <button className="link-button" onClick={() => downloadJSON("患者资料模板.json", patientTemplate())}>下载资料模板</button>
            <button className="link-button" onClick={() => downloadJSON("评分标准模板.json", scoringTemplate())}>下载评分模板</button>
          </div>
        </div>
      )}
      <footer><button className="ghost-button" onClick={cancel}>取消</button></footer>
    </TeacherDialog>
  );
}
