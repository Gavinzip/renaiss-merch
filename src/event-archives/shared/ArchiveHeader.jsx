import { HubReturnButton } from '../../components/HubReturn/HubReturnButton';
import { hubArchiveUrl } from './archiveAssets';
import { useArchiveEntrance } from './useArchiveEntrance';
import './communityArchive.css';
const copy={ 'zh-TW':{back:'返回 Hub',language:'語言'},en:{back:'Back to Hub',language:'Language'},ko:{back:'Hub로 돌아가기',language:'언어'}};
export function ArchiveHeader({locale,onLocale,brand}) {
  const root = useArchiveEntrance('.event-archive-header__brand, .event-archive-header__actions > *');
  return <header ref={root} className="event-archive-header">
    <div className="event-archive-header__brand">{brand}</div>
    <div className="event-archive-header__actions">
      <select aria-label={copy[locale].language} value={locale} onChange={event=>onLocale(event.target.value)}><option value="zh-TW">繁體中文</option><option value="en">English</option><option value="ko">한국어</option></select>
      <HubReturnButton href={hubArchiveUrl(locale)} locale={locale}>{copy[locale].back}</HubReturnButton>
    </div>
  </header>;
}
