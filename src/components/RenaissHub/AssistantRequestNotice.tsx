import type { HubAssistantCopy } from "./HubAssistantCopy";

export function AssistantRequestNotice({ copy, error, cancelled, onRetry }: { copy: HubAssistantCopy; error: "unavailable" | "busy" | "timeout" | null; cancelled: boolean; onRetry: () => void }) {
  if (!error && !cancelled) return null;
  return <div className={`assistant-request-note ${error ? "is-error" : ""}`} role={error ? "alert" : "status"}>
    <span className="assistant-request-note__icon" aria-hidden="true"><svg viewBox="0 0 20 20">{error ? <><path d="M10 3 18 17H2Z" /><path d="M10 8v4m0 2v.1" /></> : <rect x="5" y="5" width="10" height="10" rx="2" />}</svg></span>
    <div><strong>{error ? copy.errorTitle : copy.cancelled}</strong><p>{error ? copy[error] : copy.cancelledDescription}</p></div><button type="button" onClick={onRetry}>{copy.retry}<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 7a7 7 0 1 0 1 6M16 3v5h-5" /></svg></button>
  </div>;
}
