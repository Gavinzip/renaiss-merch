import { surfCampaign } from "../../../shared/surf-campaign.js";
import type { AppLocale } from "../../i18n/LocaleContext";
import { HubLogo } from "./HubLogo";
import { surfQuestCopy } from "./HubSurfQuestCopy";
import { SurfLogo } from "./SurfLogo";
import { HubMotionText } from "./HubMotionText";
import type { AccountState } from "./RenaissHubFeatures";
import { useSurfMissions } from "./useSurfMissions";
import "./SurfQuestBrand.css";

export function HubSurfQuest({ locale, account, onOpenCampaign, preview = false }: {
  locale: AppLocale; account: AccountState; onOpenCampaign: (target?: 'tasks') => void; preview?: boolean;
}) {
  const copy = surfQuestCopy[locale];
  const signedIn = !preview && account.status === 'ready' && account.session.authenticated && !account.session.user.isDemo;
  const missions = useSurfMissions(signedIn, account.status === 'ready' && account.session.authenticated ? account.session.user.sub : null);
  const mission = signedIn ? missions.state : null;
  const tasks = [
    { id: "accounts", title: copy.accounts, meta: copy.accountsMeta, action: copy.openSurf, url: surfCampaign.surfUrl,
      complete: mission?.participation?.tasks.accounts.verified === true },
    { id: "x-follow", title: copy.follow, meta: `@${surfCampaign.xHandle}`, action: copy.openX, url: surfCampaign.xUrl,
      complete: mission?.participation?.tasks.x.verified === true },
    { id: "discord-join", title: copy.join, meta: "Surf Community", action: copy.openDiscord, url: surfCampaign.discordUrl,
      complete: mission?.participation?.tasks.discord.verified === true },
  ];
  const allComplete = tasks.every(task => task.complete);
  return (
    <article className="renaiss-hub__card hub-surf-quest" id={preview ? undefined : "portal-partner"}>
      <div className="renaiss-hub__card-heading">
        <span className="hub-widget-title"><HubMotionText>{copy.eyebrow}</HubMotionText></span>
        <button type="button" data-campaign-entry="stage" className="hub-surf-quest__stage" onClick={() => onOpenCampaign()}>{copy.stage}<span aria-hidden="true"> ↗</span></button>
      </div>
      <div className="hub-surf-quest__brands" aria-hidden="true">
        <HubLogo />
        <span className="hub-surf-quest__cross">×</span>
        <SurfLogo />
      </div>
      <h2>
        <button className="hub-title-action" data-campaign-entry="title" type="button" onClick={() => onOpenCampaign()}>
          <HubMotionText>{copy.title}</HubMotionText>
        </button>
      </h2>
      <p className="hub-surf-quest__description">{copy.description}</p>
      <ol className="hub-surf-quest__tasks">
        {tasks.map((task, index) => (
          <li key={task.id} data-complete={task.complete}>
            <span className="hub-surf-quest__number" aria-hidden="true">{task.complete ? <svg viewBox="0 0 16 16"><path d="m3 8 3 3 7-7" /></svg> : `0${index + 1}`}</span>
            <div className="hub-surf-quest__task-content">
              <div className="hub-surf-quest__task-heading">
                <h3>{task.title}</h3>
                <span className="hub-surf-quest__weight" aria-live="polite">{task.complete ? copy.completed : copy.entry}</span>
              </div>
              <div className="hub-surf-quest__task-bottom">
                <span>{task.meta}</span>
                <a href={task.url} target="_blank" rel="noopener noreferrer"><span className="hub-action-label">{task.action}</span><ExternalArrow /></a>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" data-campaign-entry="details" className="hub-surf-quest__preview-action" onClick={() => onOpenCampaign()}>
        <span><span className="hub-action-label">{allComplete ? copy.viewCampaign : copy.completeTasks}</span><small>{allComplete ? copy.prizeSummary : copy.taskSummary}</small></span><ExternalArrow />
      </button>
      <footer className="hub-surf-quest__footer"><span>{copy.notOpen}</span><p>{copy.notice}</p></footer>
    </article>
  );
}

function ExternalArrow() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M5 4h7v7" /></svg>;
}
