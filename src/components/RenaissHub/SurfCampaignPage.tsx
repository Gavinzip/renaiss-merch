import { useEffect, useState } from 'react';
import { FulfillmentConsole } from '../FulfillmentConsole/FulfillmentConsole';
import { surfCampaign } from '../../../shared/surf-campaign.js';
import type { AppLocale } from '../../i18n/LocaleContext';
import type { AccountState } from './RenaissHubFeatures';
import { HubLogo } from './HubLogo';
import { HubLanguageMenu } from './HubLanguageMenu';
import { surfCampaignCopy } from './SurfCampaignCopy';
import { SurfCampaignHero } from './SurfCampaignHero';
import { SurfCampaignRewards } from './SurfCampaignRewards';
import { SurfCampaignTasks } from './SurfCampaignTasks';
import { useSurfMissions } from './useSurfMissions';
import { useSurfCampaignMotion } from './useSurfCampaignMotion';
import './SurfQuestBrand.css';

export function SurfCampaignPage({ locale, setLocale, account, motionRevision, onBack, onLogin, onRetry, onLogout, loggingOut }: {
  locale: AppLocale; setLocale: (locale: AppLocale) => void; account: AccountState;
  motionRevision: number;
  onBack: () => void; onLogin: () => void; onRetry: () => void; onLogout: () => void; loggingOut: boolean;
}) {
  const copy = surfCampaignCopy[locale];
  const motionRoot = useSurfCampaignMotion(locale, motionRevision);
  const missions = useSurfMissions(account.status === 'ready', account.status === 'ready' && account.session.authenticated ? account.session.user.sub : null);
  const [showParticipants, setShowParticipants] = useState(false);
  const administrator = account.status === 'ready' && account.session.authenticated && account.session.user.canManageFulfillment && !account.session.user.isDemo;
  useEffect(() => {
    const previous = document.title;
    document.title = 'Renaiss × Surf | Partner Campaign';
    return () => { document.title = previous; };
  }, []);
  function goTo(id: string) {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }
  function loginForMission() {
    const target = new URL(location.href);
    target.searchParams.set('mission', 'resume');
    history.replaceState(history.state, '', `${target.pathname}${target.search}${target.hash}`);
    onLogin();
  }
  return <main className="surf-page" lang={locale} ref={motionRoot}>
    <div className="surf-page__shell">
      <header className="surf-page__header" data-surf-reveal="0">
        <div className="surf-page__location"><button className="surf-page__back" type="button" onClick={onBack}><span aria-hidden="true">←</span><HubLogo /><span>{copy.back}</span></button><span className="surf-page__location-label">{copy.pageLabel}</span></div>
        <nav aria-label={copy.pageNavigation}><button type="button" onClick={() => goTo('surf-campaign-rewards')}>{copy.viewRewards}</button><button type="button" onClick={() => goTo('surf-campaign-tasks')}>{copy.viewTasks}</button></nav>
        <div className="surf-page__account-controls"><HubLanguageMenu locale={locale} setLocale={setLocale} />
          {administrator ? <button className="surf-page__logout" type="button" onClick={() => setShowParticipants(true)}>{inlineCopy[locale].participants}</button> : null}
          {account.status === 'ready' && account.session.authenticated ? <button className="surf-page__logout" type="button" onClick={onLogout} disabled={loggingOut}>{loggingOut ? inlineCopy[locale].signingOut : inlineCopy[locale].signOut}</button> : null}
        </div>
      </header>
      <SurfCampaignHero locale={locale} onTasks={() => goTo('surf-campaign-tasks')} onRewards={() => goTo('surf-campaign-rewards')} />
      <SurfCampaignRewards locale={locale} />
      <SurfCampaignTasks locale={locale} account={account} missions={missions} onLogin={loginForMission} onRetry={onRetry} />
      <section className="surf-page__details" aria-labelledby="surf-details-title">
        <div><span className="surf-page__section-number" data-surf-reveal="0">{copy.detailsSection}</span><h2 id="surf-details-title" data-surf-reveal="1">{copy.details}</h2></div>
        <div className="surf-page__facts">
          <div><span data-surf-reveal="0">{copy.schedule}</span><strong data-surf-reveal="1">{copy.scheduleValue}</strong><p data-surf-reveal="2">{copy.scheduleDescription}</p></div>
          <div><span data-surf-reveal="1">{copy.sbt}</span><strong data-surf-reveal="2">{copy.sbtValue}</strong><p data-surf-reveal="3">{copy.sbtDescription}</p></div>
        </div>
      </section>
      <footer className="surf-page__footer"><div data-surf-reveal="0"><strong>Renaiss × Surf</strong><p>{copy.previewNote}</p></div><a data-surf-reveal="1" href={surfCampaign.campaignUrl ?? surfCampaign.xUrl} target="_blank" rel="noopener noreferrer">{surfCampaign.campaignUrl ? copy.openCampaign : copy.announcement}<span aria-hidden="true">↗</span></a></footer>
    </div>
    {showParticipants && administrator ? <FulfillmentConsole initialSection="surf" onClose={() => setShowParticipants(false)} /> : null}
  </main>;
}

const inlineCopy = {
  "en": {
    participants: "Participants",
    signingOut: "Signing out",
    signOut: "Sign out"
  },
  "zh-TW": {
    participants: "抽獎名單",
    signingOut: "登出中",
    signOut: "登出"
  },
  "ko": {
    participants: "참가자",
    signingOut: "로그아웃 중",
    signOut: "로그아웃"
  }
} as const;
