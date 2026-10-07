"use client";

// Adapted from agent-ui's local Context Cards (MIT; see LICENSE.txt).
// The service provides titles and URLs, so there are no invented excerpts,
// document types, character counts, or delayed retrieval states here.
import type { AssistantMessage } from "../useHubAssistant";
import { useId, useState } from "react";

export function ContextCards({ sources, label, countLabel }: {
  sources: NonNullable<AssistantMessage["sources"]>; label: string; countLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return <div className="assistant-sources t-acc" data-open={open}>
    <button className="assistant-sources__trigger" type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}><span className="assistant-sources__dots" aria-hidden="true">↗</span><span>{label}</span><span className="assistant-sources__count">{sources.length}<span className="hub-visually-hidden"> {countLabel}</span></span><span className="assistant-sources__chevron t-acc-chevron" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></span></button>
    <div className="t-acc-panel" id={panelId} aria-hidden={!open} inert={!open}><div className="t-acc-panel-inner"><div className="assistant-context-cards">{sources.map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noopener noreferrer" style={{ animationDelay: `${index * 40}ms` }}>
      <span className="assistant-context-cards__bar"><span className="assistant-context-cards__index">{String(source.citation).padStart(2, "0")}</span><span>{new URL(source.url).hostname.replace(/^www\./, "")}</span><span className="assistant-context-cards__arrow" aria-hidden="true">↗</span></span>
      <strong>{source.title}</strong>
    </a>)}</div></div></div>
  </div>;
}
