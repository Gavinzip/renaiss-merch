import { useEffect } from 'react';
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

export function SurfCampaignPage({ locale, setLocale, account, motionRevision, onBack, onLogin, onRetry }: {
  locale: AppLocale; setLocale: (locale: AppLocale) => void; account: AccountState;
  motionRevision: number;
  onBack: () => void; onLogin: () => void; onRetry: () => void;
}) {
  const copy = surfCampaignCopy[locale];
  const motionRoot = useSurfCampaignMotion(locale, motionRevision);
  const missions = useSurfMissions(account.status === 'ready');
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
        <HubLanguageMenu locale={locale} setLocale={setLocale} />
      </header>
      <SurfCampaignHero locale={locale} onTasks={() => goTo('surf-campaign-tasks')} onRewards={() => goTo('surf-campaign-rewards')} />
      <SurfCampaignRewards locale={locale} />
      <SurfCampaignTasks locale={locale} account={account} missions={missions} onLogin={loginForMission} onRetry={onRetry} />
      <section className="surf-page__details" aria-labelledby="surf-details-title">
        <div><span className="surf-page__section-number" data-surf-reveal="0">03 / GOOD TO KNOW</span><h2 id="surf-details-title" data-surf-reveal="1">{copy.details}</h2></div>
        <div className="surf-page__facts">
          <div><span data-surf-reveal="0">{copy.schedule}</span><strong data-surf-reveal="1">{copy.scheduleValue}</strong><p data-surf-reveal="2">{copy.scheduleDescription}</p></div>
          <div><span data-surf-reveal="1">{copy.sbt}</span><strong data-surf-reveal="2">{copy.sbtValue}</strong><p data-surf-reveal="3">{copy.sbtDescription}</p></div>
        </div>
      </section>
      <footer className="surf-page__footer"><div data-surf-reveal="0"><strong>Renaiss × Surf</strong><p>{copy.previewNote}</p></div><a data-surf-reveal="1" href={surfCampaign.campaignUrl ?? surfCampaign.xUrl} target="_blank" rel="noopener noreferrer">{surfCampaign.campaignUrl ? copy.openCampaign : copy.announcement}<span aria-hidden="true">↗</span></a></footer>
    </div>
  </main>;
}
