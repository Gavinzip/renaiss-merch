"use client";

import { useId, useState } from "react";
import type { AppLocale } from "../../i18n/LocaleContext";
import { hubAssistantCopy } from "./HubAssistantCopy";
import { useHubAssistant } from "./useHubAssistant";
import { useAssistantDialog } from "./useAssistantDialog";
import { AgentChat } from "./agent-ui/Chat";
import { AssistantMark } from "./AssistantMark";

export function HubAssistant({ locale, disabled }: { locale: AppLocale; disabled: boolean }) {
  const copy = hubAssistantCopy[locale];
  const assistant = useHubAssistant(locale);
  const dialog = useAssistantDialog();
  const [question, setQuestion] = useState("");
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const descriptionId = useId();
  function close() { assistant.cancel(); dialog.close(); }
  return <>
    <button type="button" className="assistant-launch" disabled={disabled} onClick={dialog.open} aria-haspopup="dialog" aria-expanded={dialog.visible}>
      <AssistantMark /><span>{copy.launch}</span><small>Beta</small>
    </button>
    <dialog ref={dialog.ref} className={`assistant-dialog t-modal ${expanded ? "is-expanded" : ""} ${dialog.phase === "open" ? "is-open" : dialog.phase === "closing" ? "is-closing" : ""}`} aria-labelledby={headingId} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); close(); }}
      onPointerDown={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      }}>
      <header className="assistant-header">
        <div className="assistant-identity"><AssistantMark /><div><h2 id={headingId} tabIndex={-1}>Renaiss AI <span>Beta</span></h2><p id={descriptionId}>{copy.sourceHint}</p></div></div>
        <div className="assistant-actions"><button className="assistant-new" type="button" disabled={assistant.status !== "idle"} onClick={() => { assistant.reset(); setQuestion(""); dialog.ref.current?.querySelector("textarea")?.focus({ preventScroll: true }); }} aria-label={copy.clear}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg><span>{copy.clear}</span></button>
          <button className="assistant-expand" type="button" onClick={() => setExpanded(value => !value)} aria-pressed={expanded} aria-label={expanded ? copy.restore : copy.expand} title={expanded ? copy.restore : copy.expand}><svg viewBox="0 0 20 20" aria-hidden="true">{expanded ? <path d="M7 3v4H3M13 17v-4h4M3 7l4-4M17 13l-4 4" /> : <path d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6" />}</svg></button>
          <button className="assistant-close" type="button" onClick={close} aria-label={copy.close}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button></div>
      </header>
      <AgentChat copy={copy} locale={locale} active={dialog.visible} messages={assistant.messages} status={assistant.status} error={assistant.error} cancelled={assistant.cancelled} question={question}
        onQuestion={setQuestion} onSend={() => { if (assistant.status !== "idle" || !question.trim()) return; void assistant.ask(question); setQuestion(""); }}
        onCancel={assistant.cancel} onRetry={() => void assistant.retry()} />
    </dialog>
  </>;
}
