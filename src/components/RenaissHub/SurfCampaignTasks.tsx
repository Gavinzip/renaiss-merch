import { surfCampaign } from '../../../shared/surf-campaign.js';
import type { AppLocale } from '../../i18n/LocaleContext';
import type { AccountState } from './RenaissHubFeatures';
import { surfCampaignCopy } from './SurfCampaignCopy';
import { SurfSocialTask } from './SurfSocialTask';
import { SurfAccountTask } from './SurfAccountTask';
import type { useSurfMissions } from './useSurfMissions';
import { missionErrorCopy } from './missionErrorCopy';

export function SurfCampaignTasks({ locale, account, missions, onLogin, onRetry }: {
  locale: AppLocale; account: AccountState; missions: ReturnType<typeof useSurfMissions>;
  onLogin: () => void; onRetry: () => void;
}) {
  const copy = surfCampaignCopy[locale];
  const user = account.status === 'ready' && account.session.authenticated ? account.session.user : null;
  const zh = locale === 'zh-TW';
  const tasks = [
    { title: copy.accounts, entries: copy.entry, url: surfCampaign.surfUrl, action: copy.surf },
    { title: copy.follow, entries: copy.bonus, url: surfCampaign.xUrl, action: copy.x },
    { title: copy.discord, entries: copy.bonus, url: surfCampaign.discordUrl, action: copy.join },
  ];
  const entries = missions.state?.entries;

  return <section id="surf-campaign-tasks" className="surf-page__participation" aria-labelledby="surf-tasks-title">
    <div className="surf-page__participation-intro">
      <div>
        <span className="surf-page__section-number" data-surf-reveal="0">02 / YOUR QUEST</span>
        <h2 id="surf-tasks-title" tabIndex={-1} data-surf-reveal="1">{copy.tasks}</h2>
      </div>
      <div className="surf-page__participation-summary" data-surf-reveal="2">
        <span>{copy.total}</span>
        {missions.state?.authenticated ? <strong aria-live="polite">
          {entries === null ? copy.entriesPending : `${copy.entriesVerified} ${entries} / 3`}
        </strong> : null}
      </div>
      {!user || user.isDemo ? <button className="surf-page__primary" data-surf-reveal="3" type="button" onClick={onLogin}>{copy.account}<span aria-hidden="true">↗</span></button> : null}
    </div>
    <div className="surf-page__task-list"><ol>{tasks.map((task, index) => <li key={task.title}>
      <span className="surf-page__task-index" data-surf-reveal="0" aria-hidden="true">0{index + 1}</span>
      <div className="surf-page__task-content">
        <div className="surf-page__task-heading" data-surf-reveal="1"><h3>{task.title}</h3><span>{task.entries}</span></div>
        <div className="surf-page__task-bottom" data-surf-reveal="2">
          {index > 0 ? <SurfSocialTask provider={index === 1 ? 'x' : 'discord'} task={missions.state?.providers[index === 1 ? 'x' : 'discord']} locale={locale} authenticated={missions.state?.authenticated === true} loading={account.status === 'loading' || missions.loading} busy={missions.busy !== null} working={missions.busy === (index === 1 ? 'x' : 'discord')} act={missions.act} /> : <SurfAccountTask locale={locale} missions={missions} loading={account.status === 'loading' || missions.loading} onLogin={onLogin} />}
          <div className="surf-page__task-actions">
            {index === 0 && account.status === 'error' ? <><span role="alert">{copy.error}</span><button type="button" onClick={onRetry}>{copy.retry}</button></> : null}
            <a href={task.url} target="_blank" rel="noopener noreferrer">{task.action}<span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </div>
    </li>)}</ol>
      {missions.error ? <div className="surf-social-task__error" role="alert"><p>{missionErrorCopy(missions.error, zh)}</p><button type="button" onClick={missions.reload}>{copy.retry}</button></div> : null}
    </div>
  </section>;
}
