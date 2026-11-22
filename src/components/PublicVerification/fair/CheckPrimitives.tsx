import {useEffect,useId,useState,type ReactNode} from "react";
import {ArrowRight,Check,ChevronDown,Copy,ExternalLink} from "lucide-react";
import {fairCopy, type FairTextKey} from '../fairCopy';
import {usePublicValueCopy} from '../usePublicValueCopy';
import type {AppLocale} from '../../../i18n/LocaleContext';
type Source = "chain" | "published" | "browser";
const sourceName: Record<Source, FairTextKey> = {
  chain: "On-chain", published: "Published data", browser: "Computed here",
};
const short = (value: string) => value.length > 28 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;

export function ProofValue({ label, value, source, note, href, locale }: {
  label: string; value: string | number; source: Source; note: string; href?: string; locale: AppLocale;
}) {
  const t = fairCopy(locale);
  const {copied,copyError,copy}=usePublicValueCopy(locale);
  const full = String(value);
  return <div className={`vf-value vf-source-${source}`} title={note}>
    <span className="vf-value-label">{label}<small>{t(sourceName[source])}</small></span>
    <span className="vf-value-content"><code title={full}>{short(full)}</code>
      {href ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label} in BscScan`}><ExternalLink size={13} aria-hidden="true" /></a> : null}
      <button type="button" onClick={() => void copy(full)} aria-label={copyError??`${t("Copy")} ${label}`} title={copyError??(copied ? t("Copied") : t("Copy full value"))}>
        {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      </button>
    </span>
    {copyError?<span className="vf-sr-only" role="alert">{copyError}</span>:null}
  </div>;
}

export function ProofStep({ number, title, description, action, done, active, locked, working, onAction, children, locale }: {
  number: number; title: string; description: string; action: string; done: boolean;
  active: boolean; locked?: string | undefined; working: boolean; onAction: () => void; children: ReactNode; locale: AppLocale;
}) {
  const t = fairCopy(locale);
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  useEffect(() => { if (done) setExpanded(true); }, [done]);
  return <li className={`vf-step t-acc ${active ? "is-active" : ""} ${done ? "is-done" : ""} ${!active && !done ? "is-locked" : ""}`} data-step={number} data-open={done && expanded}>
    <div className="vf-step-head">
      <span className="vf-step-number">{done ? <Check size={15} aria-hidden="true" /> : String(number).padStart(2, "0")}</span>
      <div className="vf-step-heading"><h3>{title}</h3><p>{description}</p></div>
      {locked && <span className="vf-step-locked">{locked}</span>}
      {active && <button className="vf-step-action" type="button" disabled={working} onClick={onAction}>{working ? t("Checking…") : action}<ArrowRight size={14} aria-hidden="true" /></button>}
      {done && <button className="vf-step-toggle t-acc-chevron" type="button" aria-label={`${t(expanded ? "Collapse" : "Expand")} ${title}`} aria-controls={id} aria-expanded={expanded} onClick={() => setExpanded((before) => !before)}><ChevronDown size={18} aria-hidden="true" /></button>}
    </div>
    {done && <div className="vf-step-panel t-acc-panel" id={id}><div className="vf-step-panel-inner t-acc-panel-inner">{children}</div></div>}
  </li>;
}
