import { HubLogo } from "./HubLogo";

export function AssistantMark({ className = "" }: { className?: string }) {
  return <span className={`assistant-mark ${className}`} aria-hidden="true"><HubLogo /></span>;
}
