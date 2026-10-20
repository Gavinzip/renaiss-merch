import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { hubEventAssetUrl } from '../../lib/hubEventAssets';
import { HubSiteHeader } from './HubSiteHeader';
import { archivedEvents, archiveCopy } from './HubEventArchiveData';
import { eventExperienceUrl } from './eventExperienceUrl';
import recordCounts from '../../event-archives/data/summary.json';
import type { ArchiveRoute } from './useHubArchiveRoute';
import './HubEventArchive.css';
import { revealHubAfterReturn } from '../HubReturn/hubReturnMotion';

export function HubEventArchive({ route, locale, setLocale, navigation, accountAction, onBack }: {
  route: Exclude<ArchiveRoute, null>; locale: AppLocale; setLocale: (locale: AppLocale) => void;
  navigation: ReactNode; accountAction: ReactNode; onBack: () => void;
}) {
  const copy = archiveCopy[locale];
  const event = archivedEvents.find(item => item.id === route || item.id + '/winners' === route);
  const collection = [...archivedEvents].reverse();
  const totalRecords = recordCounts.football + recordCounts['pokemon-30'];
  const heading = useRef<HTMLHeadingElement>(null);
  const root = useRef<HTMLElement>(null);
  const recordsLabel = { 'zh-TW':'筆得獎紀錄', en:'winner records', ko:'당첨 기록' }[locale];
  const viewRecords = { 'zh-TW':'查看得獎紀錄', en:'View winner records', ko:'당첨 기록 보기' }[locale];
  useLayoutEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); heading.current?.focus({ preventScroll: true }); }, []);
  useLayoutEffect(() => {
    if (route === 'index' && root.current) return revealHubAfterReturn(root.current);
  }, [route]);
  useEffect(() => {
    if (event) window.location.replace(eventExperienceUrl(event.id, locale, route.endsWith('/winners')));
  }, [event, locale, route]);
  useEffect(() => {
    const previous = document.title;
    document.title = copy.label + ' | Renaiss';
    return () => { document.title = previous; };
  }, [copy.label]);
  if (event) return <p role="status">{event.copy[locale].title}…</p>;
  return <main className="hub-event-archive" ref={root} lang={locale}>
    <div className="hub-event-archive__content">
      <HubSiteHeader locale={locale} setLocale={setLocale} location={copy.label} onBack={onBack} navigation={navigation} accountAction={accountAction}/>
      <div className="hub-event-archive__intro"><div><p className="hub-event-archive__eyebrow">RENAISS MEMORIES</p><h1 ref={heading} tabIndex={-1}>{copy.title}</h1><p className="hub-event-archive__lede">{copy.intro}</p></div><div className="hub-event-archive__edition"><strong>2026</strong><span>{copy.edition}</span></div></div>
      <div className="hub-event-archive__collection-label"><span>{copy.collection}</span><span>02 {copy.events}<i/>{totalRecords} {recordsLabel}</span></div>
      <div className="hub-event-archive__grid">
        {collection.map(item=><article className={'hub-event-archive__card hub-event-archive__card--'+item.id} key={item.id}>
          <a className={'hub-event-archive__media hub-event-archive__media--'+item.id} href={eventExperienceUrl(item.id,locale)} aria-label={item.copy[locale].title}><img src={hubEventAssetUrl(item.id)} alt="" width={item.id==='football'?1672:1254} height={item.id==='football'?941:1254}/><span className="hub-event-archive__cover-note">{item.id==='football'?'THE WORLD CUP, TOGETHER.':'THIRTY YEARS. ONE COMMUNITY.'}</span><span className="hub-event-archive__cover-arrow" aria-hidden="true">↗</span></a>
          <div className="hub-event-archive__card-copy"><div className="hub-event-archive__card-meta"><span>{item.copy[locale].date}</span><span>{copy.ended}</span></div><h2><a href={eventExperienceUrl(item.id,locale)}>{item.copy[locale].title}</a></h2><p>{item.copy[locale].summary}</p><div className="hub-event-archive__card-bottom"><span><strong>{recordCounts[item.id]}</strong> {recordsLabel}</span><a href={eventExperienceUrl(item.id,locale,true)}>{viewRecords}<span aria-hidden="true">↗</span></a></div></div>
        </article>)}
      </div>
      <footer className="hub-event-archive__collection-footer"><span>RENAISS / COMMUNITY ARCHIVE</span><span>{copy.footer}</span></footer>
    </div>
  </main>;
}
