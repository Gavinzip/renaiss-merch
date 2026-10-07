import { surfCampaign } from "../../../shared/surf-campaign.js";
import type { AppLocale } from "../../i18n/LocaleContext";
import { HubLogo } from "./HubLogo";
import { surfQuestCopy } from "./HubSurfQuestCopy";
import { SurfLogo } from "./SurfLogo";
import { HubMotionText } from "./HubMotionText";

export function HubSurfQuest({ locale, onOpenCampaign, preview = false }: {
  locale: AppLocale; onOpenCampaign: () => void; preview?: boolean;
}) {
  const copy = surfQuestCopy[locale];
  const tasks = [
    { id: "accounts", title: copy.accounts, meta: copy.accountsMeta, action: copy.openSurf, url: surfCampaign.surfUrl },
    { id: "x-follow", title: copy.follow, meta: `@${surfCampaign.xHandle}`, action: copy.openX, url: surfCampaign.xUrl },
    { id: "discord-join", title: copy.join, meta: "Surf Community", action: copy.openDiscord, url: surfCampaign.discordUrl },
  ];
  return (
    <article className="renaiss-hub__card hub-surf-quest" id={preview ? undefined : "portal-partner"}>
      <div className="renaiss-hub__card-heading">
        <span className="renaiss-hub__eyebrow">{copy.eyebrow}</span>
        <button type="button" data-campaign-entry="stage" className="hub-surf-quest__stage" onClick={onOpenCampaign}>{copy.stage}<span aria-hidden="true"> ↗</span></button>
      </div>
      <div className="hub-surf-quest__brands" aria-hidden="true">
        <HubLogo />
        <span className="hub-surf-quest__cross">×</span>
        <SurfLogo />
      </div>
      <h2>
        <button className="hub-title-action" data-campaign-entry="title" type="button" onClick={onOpenCampaign}>
          <HubMotionText>{copy.title}</HubMotionText>
        </button>
      </h2>
      <p className="hub-surf-quest__description">{copy.description}</p>
      <ol className="hub-surf-quest__tasks">
        {tasks.map((task, index) => (
          <li key={task.id}>
            <span className="hub-surf-quest__number" aria-hidden="true">0{index + 1}</span>
            <div className="hub-surf-quest__task-content">
              <div className="hub-surf-quest__task-heading">
                <h3>{task.title}</h3>
                <span className="hub-surf-quest__weight" data-required={surfCampaign.tasks[index].required} aria-label={surfCampaign.tasks[index].required ? copy.required : copy.bonus}>
                  <span className="hub-surf-quest__weight-full" aria-hidden="true">{surfCampaign.tasks[index].required ? copy.required : copy.bonus}</span>
                  <span className="hub-surf-quest__weight-compact" aria-hidden="true">{surfCampaign.tasks[index].required ? copy.requiredCompact : copy.bonusCompact}</span>
                </span>
              </div>
              <div className="hub-surf-quest__task-bottom">
                <span>{task.meta}</span>
                <a href={task.url} target="_blank" rel="noopener noreferrer"><span className="hub-action-label">{task.action}</span><ExternalArrow /></a>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" data-campaign-entry="details" className="hub-surf-quest__preview-action" onClick={onOpenCampaign}>
        <span><span className="hub-action-label">{copy.viewCampaign}</span><small>{copy.prizeSummary}</small></span><ExternalArrow />
      </button>
      <footer className="hub-surf-quest__footer"><span>{copy.notOpen}</span><p>{copy.notice}</p></footer>
    </article>
  );
}

function ExternalArrow() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M5 4h7v7" /></svg>;
}
