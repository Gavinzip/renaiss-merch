import { useEffect, type ReactNode } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { featuredCampaignCopy, readFeaturedCampaign } from '../../config/hubCampaigns';
import type { AccountState } from './RenaissHubFeatures';
import { HubSiteHeader } from './HubSiteHeader';
import { HubFeaturedCampaign } from './HubFeaturedCampaign';
import { HubSurfQuest } from './HubSurfQuest';
import { useSurfCampaignMotion } from './useSurfCampaignMotion';
import './HubActivitiesPage.css';
import './HubEventSurface.css';

const pageCopy = {
  'zh-TW': { intro: '查看活動內容與參與方式，前往正式網站參加。', footer: '連結社群，開啟下一段體驗。' },
  en: { intro: 'Explore the campaign and how to participate, then join on its official site.', footer: 'Connect with the community. Find your next experience.' },
  ko: { intro: '활동 내용과 참여 방법을 확인하고 공식 사이트에서 참여하세요.', footer: '커뮤니티와 연결하고 새로운 경험을 시작하세요.' },
};

export function HubActivitiesPage({ locale, setLocale, navigation, accountAction, account, motionRevision, onGoHome, onOpenSurf }: {
  locale: AppLocale; setLocale: (locale: AppLocale) => void;
  navigation: ReactNode; accountAction: ReactNode; account: AccountState;
  motionRevision: number; onGoHome: () => void; onOpenSurf: (target?: 'tasks') => void;
}) {
  const campaign = readFeaturedCampaign();
  const label = featuredCampaignCopy[locale].label;
  const copy = pageCopy[locale];
  const root = useSurfCampaignMotion(locale, motionRevision);
  useEffect(() => {
    const previous = document.title;
    document.title = `${label} | Renaiss`;
    return () => { document.title = previous; };
  }, [label]);

  return <main className="hub-activities" ref={root} lang={locale}>
    <div className="hub-activities__content">
      <HubSiteHeader locale={locale} setLocale={setLocale} location={label} onBack={onGoHome} navigation={navigation} accountAction={accountAction} />
      <section className="hub-activities__intro" aria-labelledby="hub-activities-title">
        <p data-surf-reveal="0" className="hub-activities__eyebrow">RENAISS / ACTIVITIES</p>
        <h1 id="hub-activities-title" tabIndex={-1} data-surf-reveal="1">{label}</h1>
        <p data-surf-reveal="2" className="hub-activities__lede">{copy.intro}</p>
      </section>
      <div className="hub-activities__campaign" data-surf-reveal="3">
        {campaign.kind === 'external'
          ? <HubFeaturedCampaign campaign={campaign} locale={locale} standalone />
          : <HubSurfQuest locale={locale} account={account} onOpenCampaign={onOpenSurf} />}
      </div>
      <footer className="hub-activities__footer" data-surf-reveal="4"><span>RENAISS / COMMUNITY</span><span>{copy.footer}</span></footer>
    </div>
  </main>;
}
