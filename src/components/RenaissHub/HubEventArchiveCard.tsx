import type { AppLocale } from '../../i18n/LocaleContext';
import type { ArchivedEvent } from './HubEventArchiveData';
import { archiveCopy } from './HubEventArchiveData';
import { eventExperienceUrl } from './eventExperienceUrl';
import { hubEventAssetUrl } from '../../lib/hubEventAssets';
import recordCounts from '../../event-archives/data/summary.json';
import { surfCampaign } from '../../../shared/surf-campaign.js';
import { SurfArchiveCover } from './SurfArchiveCover';
import { WorldsArchiveCover } from './WorldsArchiveCover';
import { BbwArchiveCover } from './BbwArchiveCover';
import { bbwArchive } from '../../event-archives/bbw/archiveData';
import { worlds2026PrizeCount } from '../../event-archives/worlds2026';
import type { ArchiveEventId } from './useHubArchiveRoute';

const labels = {
  'zh-TW': { records: '筆得獎紀錄', prizes: '份活動獎項', winners:'位不同得獎人', revealed:'社群抽獎已揭曉', viewRecords: '查看得獎紀錄' },
  en: { records: 'winner records', prizes: 'campaign prizes', winners:'distinct winners', revealed:'Community draw revealed', viewRecords: 'View winner records' },
  ko: { records: '당첨 기록', prizes: '이벤트 경품', winners:'명의 당첨자', revealed:'커뮤니티 추첨 결과 공개', viewRecords: '당첨 기록 보기' },
};
const coverNotes = { football: 'THE WORLD CUP, TOGETHER.', 'pokemon-30': 'THIRTY YEARS. ONE COMMUNITY.' };

function ArchiveCover({ id, locale }: { id: ArchiveEventId; locale: AppLocale }) {
  if (id === 'surf') return <SurfArchiveCover locale={locale} />;
  if (id === 'worlds-2026') return <WorldsArchiveCover />;
  if (id === 'bbw') return <BbwArchiveCover />;
  return <>
    <img src={hubEventAssetUrl(id)} alt="" width={id === 'football' ? 1672 : 1254} height={id === 'football' ? 941 : 1254} />
    <span className="hub-event-archive__cover-note">{coverNotes[id]}</span>
  </>;
}

export function HubEventArchiveCard({ event, locale, index }: { event: ArchivedEvent; locale: AppLocale; index: number }) {
  const copy = event.copy[locale], common = archiveCopy[locale], label = labels[locale];
  const hasPrizeCount = event.id === 'surf' || event.id === 'worlds-2026';
  const count = event.id === 'surf' ? surfCampaign.plannedRewards.mysteryBoxes + surfCampaign.plannedRewards.proMonthTrials : event.id === 'worlds-2026' ? worlds2026PrizeCount : event.id === 'bbw' ? bbwArchive.uniqueWinnerCount : recordCounts[event.id];
  const href = eventExperienceUrl(event.id, locale);
  return <article className={'hub-event-archive__card hub-event-archive__card--' + event.id} data-surf-reveal={index}>
    <a className={'hub-event-archive__media hub-event-archive__media--' + event.id} href={href} aria-label={copy.title}>
      <ArchiveCover id={event.id} locale={locale} />
      <span className="hub-event-archive__cover-arrow" aria-hidden="true">↗</span>
    </a>
    <div className="hub-event-archive__card-copy">
      <div className="hub-event-archive__card-meta"><span>{copy.date}</span><span>{event.id==='bbw'?label.revealed:common.ended}</span></div>
      <h2><a href={href}>{copy.title}</a></h2><p>{copy.summary}</p>
      <div className="hub-event-archive__card-bottom">
        <span><strong>{count}</strong> {event.id==='bbw'?label.winners:hasPrizeCount ? label.prizes : label.records}</span>
        <a href={eventExperienceUrl(event.id, locale, true)}>{label.viewRecords}<span aria-hidden="true">↗</span></a>
      </div>
    </div>
  </article>;
}
