import { useId, useState } from "react";
import type { RenaissSession } from "../../lib/renaissAuth";
import type { RenaissHubCopy } from "./RenaissHubCopy";
import { HubMerchHero } from "./HubMerchHero";
import { HubMotionText } from "./HubMotionText";
import type { AppLocale } from "../../i18n/LocaleContext";

export type AccountState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; session: RenaissSession };

export function HubQuestline({ copy, preview = false }: { copy: RenaissHubCopy["questline"]; preview?: boolean }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  return (
    <article
      className="renaiss-hub__card renaiss-hub__quest"
      id={preview ? undefined : "portal-questline"}
    >
      <div className="renaiss-hub__card-heading">
        <span className="renaiss-hub__eyebrow">{copy.eyebrow}</span>
        <span className="renaiss-hub__status">{copy.stage}</span>
      </div>
      <h2 className="renaiss-hub__quest-title"><HubMotionText>{copy.title}</HubMotionText></h2>
      <p className="renaiss-hub__description">{copy.description}</p>
      <ol className="renaiss-hub__journey">
        {copy.steps.map((step, index) => (
          <li key={step.title}>
            <span className="renaiss-hub__step-number">0{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <span>{step.description}</span>
            </div>
          </li>
        ))}
      </ol>
      <div className="t-acc renaiss-hub__quest-disclosure" data-open={open}>
        <button
          className="t-acc-head"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen(!open)}
          type="button"
        >
          {copy.disclosure}
          <span className="t-acc-chevron">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 6.5L8 10.5L12 6.5" />
            </svg>
          </span>
        </button>
        <div
          className="t-acc-panel"
          id={detailsId}
          aria-hidden={!open}
          inert={!open}
        >
          <div className="t-acc-panel-inner">
            <p>{copy.note}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function HubMerch({
  copy,
  locale,
  enterRequested,
  loadProgress,
  loadState,
  onEnter,
  preview = false,
}: {
  locale: AppLocale;
  copy: RenaissHubCopy["merch"];
  enterRequested: boolean;
  loadProgress: number;
  loadState: "idle" | "loading" | "error";
  onEnter: () => void;
  preview?: boolean;
}) {
  const preparing = enterRequested && loadState === "loading";
  return (
    <article className="renaiss-hub__card renaiss-hub__merch" id={preview ? undefined : "portal-merch"}>
      <HubMerchHero locale={locale} eyebrow={copy.eyebrow} />
      <div className="renaiss-hub__merch-content">
        <div>
          <h2>
            <button className="hub-title-action" type="button" disabled={preparing} onClick={onEnter}>
              <HubMotionText>{copy.title}</HubMotionText>
            </button>
          </h2>
          <p className="renaiss-hub__description">{copy.description}</p>
        </div>
        <button
          className="renaiss-hub__button t-learn"
          data-preparing={preparing}
          aria-label={preparing ? `${copy.preparing} ${loadProgress}%` : copy.action}
          disabled={preparing}
          onClick={onEnter}
          type="button"
        >
          <span className="renaiss-hub__merch-action-label">{preparing ? `${copy.preparing} ${loadProgress}%` : copy.action}</span>
          <ActionChevron />
        </button>
        {enterRequested && loadState === "error" ? (
          <p className="renaiss-hub__error" role="alert">
            {copy.error}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function ActionChevron() {
  return (
    <span className="t-learn-chevron" aria-hidden="true">
      <svg className="renaiss-hub__arrow" viewBox="0 0 16 16">
        <path className="t-learn-arm t-learn-arm-top" d="M6 4L10 8" />
        <path className="t-learn-arm t-learn-arm-bot" d="M10 8L6 12" />
      </svg>
    </span>
  );
}
