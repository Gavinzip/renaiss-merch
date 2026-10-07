"use client";

import { useClipboardCopy } from "./useClipboardCopy";

export function AssistantAnswerActions({ text, label, copiedLabel, errorLabel }: {
  text: string; label: string; copiedLabel: string; errorLabel: string;
}) {
  const { state, copy } = useClipboardCopy();
  return <div className="assistant-answer-actions">
    <button type="button" onClick={() => void copy(text)} disabled={state === "copying"} className={state === "copied" ? "is-copied" : ""} aria-label={state === "copied" ? copiedLabel : label} title={state === "copied" ? copiedLabel : label}>
      <span className="assistant-copy-icons" aria-hidden="true"><svg className="assistant-copy-original" viewBox="0 0 20 20"><rect x="7" y="7" width="9" height="10" rx="2" /><path d="M4 13H3.5A1.5 1.5 0 0 1 2 11.5v-8A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5V4" /></svg><svg className="assistant-copy-success" viewBox="0 0 20 20"><path className="assistant-copy-check" d="m5 10 3 3 7-7" /></svg></span>
      <span className="assistant-copy-labels" aria-hidden="true"><span>{label}</span><span>{copiedLabel}</span></span>
    </button>
    {state === "error" ? <span className="assistant-copy-error" role="alert">{errorLabel}</span> : null}
    <span className="hub-visually-hidden" role="status">{state === "copied" ? copiedLabel : ""}</span>
  </div>;
}
