import type { SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { useLocale } from '../../i18n/LocaleContext';
import { surfPreviewLogoUrl } from '../RenaissHub/hubPreviewAssets';
import { surfCampaignAssets } from '../RenaissHub/surfCampaignAssets';
import { SurfProCredential } from './SurfProCredential';
import { surfStoreCopy } from './surfStoreCopy';
import type { SurfStoreRelease } from '../../hooks/useStorefrontFeatures';
import { SurfStoreAvailability } from './SurfStoreAvailability';
import { useSurfStoreInventory } from './SurfStoreInventoryContext';

type Props = {
  reward: SurfActiveStoreReward;
  release: SurfStoreRelease | null;
  onOpenReward: (id: SurfActiveStoreReward['id']) => void;
  checking: boolean;
  busy: boolean;
  error: string | null;
};

export function SurfStoreRewardCard({ reward, release, onOpenReward, checking, busy, error }: Props) {
  const { locale } = useLocale();
  const copy = surfStoreCopy[locale];
  const inventory = useSurfStoreInventory();
  const isRetired = inventory.status === 'ready' && inventory.rewards[reward.id]?.soldOut === true;
  const benefit = copy.benefits[reward.id];
  const titleId = `surf-store-${reward.id}-title`;
  const opensAt = release ? new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(release.opensAt)) : '';
  const releaseCopy = {
    'zh-TW': { opens: `台灣時間 ${opensAt} 開放`, checking: '正在檢查資格…' },
    en: { opens: `Opens ${opensAt} (UTC+8)`, checking: 'Checking eligibility…' },
    ko: { opens: `${opensAt} (UTC+8) 오픈`, checking: '자격 확인 중…' },
  }[locale];

  return (
    <>
      <article className={`surf-store-card surf-store-card--${reward.id}${isRetired ? ' is-retired' : ''}`} aria-labelledby={titleId}>
        <div className="surf-store-card__visual">
          {!isRetired ? <span className="surf-store-card__preview">{copy.preview}</span> : null}
          {reward.id === 'mystery-box' ? (
            <img className="surf-store-card__box" src={surfCampaignAssets().box} alt="Surf Mystery Box" />
          ) : (
            <div className="surf-store-card__credential" aria-hidden="true">
              <SurfProCredential logoUrl={surfPreviewLogoUrl()} duration={benefit.value} />
            </div>
          )}
        </div>
        <div className="surf-store-card__body">
          <p className="surf-store-card__edition">RENAISS × SURF / {benefit.label}</p>
          <div className="surf-store-card__title-row">
            <h2 id={titleId}>{benefit.name}</h2>
            <SurfStoreAvailability reward={reward} />
          </div>
          <p className="surf-store-card__description">{benefit.description}</p>
          <button type="button" disabled={!release?.open || busy}
            data-surf-reward-opener={reward.id} onClick={() => onOpenReward(reward.id)}>
            {checking ? releaseCopy.checking : release?.open ? benefit.view : release ? releaseCopy.opens : copy.unavailable}
          </button>
          {error ? <p className="surf-store-card__description" role="alert">{error}</p> : null}
        </div>
      </article>
    </>
  );
}
