import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { HubSiteHeader } from './HubSiteHeader';
import { archivedEvents, archiveCopy } from './HubEventArchiveData';
import { eventExperienceUrl } from './eventExperienceUrl';
import type { ArchiveRoute } from './useHubArchiveRoute';
import './HubEventArchive.css';
import './HubEventSurface.css';
import { revealHubAfterReturn } from '../HubReturn/hubReturnMotion';
import { useSurfCampaignMotion } from './useSurfCampaignMotion';
import { HubEventArchiveCard } from './HubEventArchiveCard';

export function HubEventArchive({ route, locale, setLocale, navigation, accountAction, onBack }: {
  route: Exclude<ArchiveRoute, null>; locale: AppLocale; setLocale: (locale: AppLocale) => void;
  navigation: ReactNode; accountAction: ReactNode; onBack: () => void;
}) {
  const copy = archiveCopy[locale];
  const event = archivedEvents.find(item => item.id === route || item.id + '/winners' === route);
  const collection = [...archivedEvents].reverse();
  const heading = useRef<HTMLHeadingElement>(null);
  const root = useSurfCampaignMotion(locale, route === 'index' ? 0 : 1);
  useLayoutEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); heading.current?.focus({ preventScroll: true }); }, [route]);
  useLayoutEffect(() => {
    if (route === 'index' && root.current) return revealHubAfterReturn(root.current);
  }, [route]);
  useEffect(() => {
    if (event) window.location.replace(eventExperienceUrl(event.id, locale, route.endsWith('/winners')));
  }, [event, locale, route]);
  useEffect(() => {
    const previous = document.title;
    document.title = (event ? event.copy[locale].title : copy.label) + ' | Renaiss';
    return () => { document.title = previous; };
  }, [copy.label, event, locale]);
  if (event) return <p role="status">{event.copy[locale].title}…</p>;
  return <main className="hub-event-archive" ref={root} lang={locale}>
    <div className="hub-event-archive__content">
      <HubSiteHeader locale={locale} setLocale={setLocale} location={copy.label} onBack={onBack} navigation={navigation} accountAction={accountAction}/>
      <div className="hub-event-archive__intro"><div><p className="hub-event-archive__eyebrow">RENAISS MEMORIES</p><h1 ref={heading} tabIndex={-1}>{copy.title}</h1><p className="hub-event-archive__lede">{copy.intro}</p></div><div className="hub-event-archive__edition"><strong>2026</strong><span>{copy.edition}</span></div></div>
      <div className="hub-event-archive__collection-label"><span>{copy.collection}</span><span>{String(collection.length).padStart(2, '0')} {copy.events}</span></div>
      <div className="hub-event-archive__grid">
        {collection.map((item, index) => <HubEventArchiveCard event={item} locale={locale} index={index} key={item.id} />)}
      </div>
      <footer className="hub-event-archive__collection-footer"><span>RENAISS / COMMUNITY ARCHIVE</span><span>{copy.footer}</span></footer>
    </div>
  </main>;
}
