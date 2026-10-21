"use client";
import { useEffect, useState } from "react";
import { caseFixture, type DemoState, type Exam } from "./demo-data";
import EvaluationReportView from "./evaluation-report";
import { CaseLibrary, CaseDetail } from "./teacher-cases";
import { ExamBuilder, ExamList, PublishedExam } from "./teacher-exams";
import {
  TEACHER_KEY,
  initialTeacherStore,
  readTeacherStore,
  draftToExam,
  type TeacherStore,
  type TeachingCase,
  type ExamDraft,
} from "./teacher-store";
import { downloadJSON } from "./teacher-ui";

export default function TeacherPortal({
  path,
  state,
  go,
  onPublish,
}: {
  path: string;
  state: DemoState;
  go: (path: string) => void;
  onPublish: (exam: Exam) => boolean;
}) {
  const [store, setStore] = useState<TeacherStore>(initialTeacherStore);
  const [ready, setReady] = useState(false);
  const [fault, setFault] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setStore(readTeacherStore(localStorage.getItem(TEACHER_KEY)));
      } catch (e) {
        setFault(
          e instanceof Error ? e.message : "教师资料读取失败，原记录已保留。",
        );
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const timer = setTimeout(() => setError(""), 0);
    return () => clearTimeout(timer);
  }, [path]);
  const commit = (next: TeacherStore, message: string) => {
    if (!ready || fault) return false;
    try {
      localStorage.setItem(TEACHER_KEY, JSON.stringify(next));
      setStore(next);
      setError("");
      setNotice(message);
      return true;
    } catch {
      setError(
        "保存失败：浏览器空间不足或存储被限制。请减少图片或导出备份后重试，原记录已保留。",
      );
      return false;
    }
  };
  const saveCase = (record: TeachingCase) => {
    if (record.builtin && record.id !== caseFixture.id) return false;
    const existing = store.cases.some((c) => c.id === record.id);
    return commit(
      {
        ...store,
        cases: existing
          ? store.cases.map((c) => (c.id === record.id ? record : c))
          : [...store.cases, record],
      },
      "病例已保存",
    );
  };
  const saveDraft = (draft: ExamDraft) =>
    commit(
      {
        ...store,
        drafts: [draft, ...store.drafts.filter((d) => d.id !== draft.id)],
      },
      "考试草稿已保存",
    );
  const publish = (draft: ExamDraft): "published" | "cancelled" | "failed" => {
    if (draft.caseId !== caseFixture.id) return "failed";
    if (
      state.exam &&
      state.attempt?.status !== "not_started" &&
      !window.confirm(
        "发布后将切换学生端的当前演示考试。已有作答将归档保留，是否继续？",
      )
    )
      return "cancelled";
    const next: TeacherStore = {
      ...store,
      drafts: store.drafts.filter((d) => d.id !== draft.id),
      archives: state.exam
        ? [
            {
              id: crypto.randomUUID(),
              exam: structuredClone(state.exam),
              attempt: state.attempt ? structuredClone(state.attempt) : null,
              archivedAt: new Date().toISOString(),
            },
            ...store.archives,
          ]
        : store.archives,
    };
    if (!commit(next, "考试已发布，可进入学生演示")) return "failed";
    if (!onPublish(draftToExam(draft))) {
      commit(store, "");
      setError("发布保存失败，草稿与原考试已保留，请检查浏览器存储后重试。");
      return "failed";
    }
    return "published";
  };
  if (!ready) return <p className="t-note">正在读取教师资料…</p>;
  if (fault)
    return (
      <div className="t-page">
        <p role="alert" className="t-error">
          {fault}
        </p>
        <button
          className="ghost-button"
          onClick={() =>
            downloadJSON("教师原记录备份.json", {
              raw: localStorage.getItem(TEACHER_KEY),
            })
          }
        >
          导出原记录
        </button>
      </div>
    );
  let view;
  if (path === "/teacher/cases")
    view = (
      <CaseLibrary
        records={store.cases}
        save={saveCase}
        remove={(id) => {
          if (id !== caseFixture.id)
            commit(
              { ...store, cases: store.cases.filter((c) => c.id !== id) },
              "病例已删除",
            );
        }}
        go={go}
      />
    );
  else if (path.startsWith("/teacher/cases/")) {
    const record = store.cases.find(
      (c) => c.id === path.slice("/teacher/cases/".length),
    );
    view = record ? (
      <CaseDetail key={record.id} record={record} save={saveCase} go={go} />
    ) : (
      <NotFound go={() => go("/teacher/cases")} />
    );
  } else if (
    path === "/teacher/exams/new" ||
    path.startsWith("/teacher/exams/draft/")
  ) {
    const id = path.slice("/teacher/exams/draft/".length);
    const draft = store.drafts.find((d) => d.id === id);
    view =
      path === "/teacher/exams/new" || draft ? (
        <ExamBuilder
          key={path}
          original={draft}
          cases={store.cases}
          save={saveDraft}
          publish={publish}
          go={go}
        />
      ) : (
        <NotFound go={() => go("/teacher/exams")} />
      );
  } else if (path.startsWith("/teacher/submissions/")) {
    const id = path
      .slice("/teacher/submissions/".length)
      .replace(/\/evaluation$/, "");
    const archive = store.archives.find((a) => a.attempt?.id === id);
    const exam =
      state.attempt?.id === id ? state.exam : (archive?.exam ?? null);
    const attempt =
      state.attempt?.id === id ? state.attempt : (archive?.attempt ?? null);
    view =
      exam && attempt ? (
        <EvaluationReportView
          role="teacher"
          exam={exam}
          attempt={attempt}
          go={go}
          backPath={
            archive ? `/teacher/exams/archive/${archive.id}` : undefined
          }
          allowReplay={!archive}
        />
      ) : (
        <NotFound go={() => go("/teacher/exams")} />
      );
  } else if (path.startsWith("/teacher/exams/")) {
    const archive = path.startsWith("/teacher/exams/archive/")
      ? store.archives.find(
          (a) => a.id === path.slice("/teacher/exams/archive/".length),
        )
      : undefined;
    const exam =
      archive?.exam ??
      (path === `/teacher/exams/${state.exam?.id}` ? state.exam : null);
    view = exam ? (
      <PublishedExam
        exam={exam}
        attempt={archive ? archive.attempt : state.attempt}
        archived={Boolean(archive)}
        go={go}
      />
    ) : (
      <NotFound go={() => go("/teacher/exams")} />
    );
  } else
    view = (
      <ExamList
        state={state}
        drafts={store.drafts}
        archives={store.archives}
        saveDraft={saveDraft}
        removeDraft={(id) =>
          commit(
            { ...store, drafts: store.drafts.filter((d) => d.id !== id) },
            "草稿已删除",
          )
        }
        go={go}
      />
    );
  return (
    <>
      {notice && (
        <div className="t-notice" role="status">
          {notice}
        </div>
      )}
      {error &&
        !(
          path === "/teacher/exams/new" ||
          path.startsWith("/teacher/exams/draft/")
        ) && (
          <p className="t-error" role="alert">
            {error}
          </p>
        )}
      {view}
    </>
  );
}
function NotFound({ go }: { go: () => void }) {
  return (
    <div className="t-empty">
      <h1>没有找到这条记录</h1>
      <button className="ghost-button" onClick={go}>
        返回列表
      </button>
    </div>
  );
}
