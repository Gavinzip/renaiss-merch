import type { AppLocale } from '../../i18n/LocaleContext';
import { surfCampaign } from '../../../shared/surf-campaign.js';
import { HubWordmark } from './HubWordmark';
import { SurfLogo } from './SurfLogo';
import { hubEventAssetUrl } from '../../lib/hubEventAssets';
import './SurfArchiveCover.css';

const trialLabel = { 'zh-TW': 'Pro 一個月體驗', en: 'One-month Pro trials', ko: 'Pro 1개월 체험권' };

export function SurfArchiveCover({ locale }: { locale: AppLocale }) {
  const prizes = surfCampaign.plannedRewards;
  return <div className="surf-archive-cover" aria-hidden="true">
    <div className="surf-archive-cover__copy">
      <div className="surf-archive-cover__brands"><HubWordmark /><i>×</i><span><SurfLogo />Surf</span></div>
      <div className="surf-archive-cover__prizes">
        <div><strong>{prizes.mysteryBoxes}</strong><span>Mystery Box</span></div>
        <div><strong>{prizes.proMonthTrials}</strong><span>{trialLabel[locale]}</span></div>
      </div>
    </div>
    <img className="surf-archive-cover__box" src={hubEventAssetUrl('surf')} alt="" width={800} height={800} />
  </div>;
}
