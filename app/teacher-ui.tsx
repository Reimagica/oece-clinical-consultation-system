"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";

export function TeacherDialog({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      className={`t-dialog${wide ? " wide" : ""}`}
      ref={ref}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          className="t-close"
          aria-label="关闭"
          onClick={close}
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function TeacherTabs({
  options,
  value,
  change,
  label,
}: {
  options: readonly string[];
  value: string;
  change: (value: string) => void;
  label: string;
}) {
  return (
    <div className="t-tabs" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option}
          aria-pressed={value === option}
          onClick={() => change(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
export function PortalNavIcon({
  kind,
}: {
  kind: "cases" | "exams" | "history" | "feedback";
}) {
  return (
    <svg
      className="portal-nav-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "cases" && (
        <>
          <path d="M3 7h7l2 2h9v11H3z" />
          <path d="M3 7V4h7l2 3" />
        </>
      )}
      {kind === "exams" && (
        <>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3" />
        </>
      )}
      {kind === "history" && (
        <>
          <path d="M3 11a9 9 0 1 1 2 7M3 5v6h6M12 7v5l3 2" />
        </>
      )}
      {kind === "feedback" && (
        <>
          <path d="M4 19V5M4 19h16M8 15l4-5 4 2 4-7" />
        </>
      )}
    </svg>
  );
}
export function downloadJSON(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
