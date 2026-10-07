"use client";

import { useEffect, useId } from "react";
import type { RefObject } from "react";
import type { HubAssistantCopy } from "./HubAssistantCopy";
import { ComposerBorderGlow, resetComposerGlow, trackComposerGlow } from "./effects/ComposerBorderGlow";

export function AssistantComposer({ copy, active, busy, question, inputRef, onQuestion, onSend, onCancel }: {
  copy: HubAssistantCopy; active: boolean; busy: boolean; question: string; inputRef: RefObject<HTMLTextAreaElement | null>;
  onQuestion: (question: string) => void; onSend: () => void; onCancel: () => void;
}) {
  const inputId = useId();
  useEffect(() => {
    const input = inputRef.current;
    if (!input || !active) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 144)}px`;
  }, [question, active, inputRef]);
  function send() { if (!busy && question.trim()) { onSend(); inputRef.current?.focus(); } }
  return <form className={`assistant-composer ${busy ? "is-waiting" : ""}`} onPointerMove={trackComposerGlow} onPointerLeave={resetComposerGlow} onSubmit={event => { event.preventDefault(); send(); }}>
    <ComposerBorderGlow />
    <div className="assistant-composer__input"><label className="hub-visually-hidden" htmlFor={inputId}>{copy.placeholder}</label>
      <textarea ref={inputRef} id={inputId} autoFocus rows={1} maxLength={1200} value={question} placeholder={copy.placeholder} onChange={event => onQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />
      {question ? <button type="button" className="assistant-clear" aria-label={copy.clearQuestion} onClick={() => { onQuestion(""); inputRef.current?.focus(); }}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 5 6 6M11 5l-6 6" /></svg></button> : null}
    </div>
    <div className="assistant-composer__footer"><div className="assistant-composer__controls">
      {question.length >= 960 ? <span className={`assistant-character-count ${question.length >= 1150 ? "is-near-limit" : ""}`} aria-label={`${copy.characterCount}: ${question.length}/1200`}>{question.length}<span>/1200</span></span> : null}
      <button className={`assistant-send ${busy ? "is-stop" : ""}`} type="button" disabled={!busy && !question.trim()} onClick={() => { if (busy) { onCancel(); inputRef.current?.focus(); } else send(); }} aria-label={busy ? copy.cancel : copy.send}>
        <svg className="assistant-send__arrow" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15V5M5 10l5-5 5 5" /></svg><svg className="assistant-send__stop" viewBox="0 0 20 20" aria-hidden="true"><rect x="6" y="6" width="8" height="8" rx="1.5" /></svg>
      </button>
    </div></div>
  </form>;
}
