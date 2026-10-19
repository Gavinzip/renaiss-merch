import type { SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { useLocale } from '../../i18n/LocaleContext';
import { surfPreviewLogoUrl } from '../RenaissHub/hubPreviewAssets';
import { surfCampaignAssets } from '../RenaissHub/surfCampaignAssets';
import { SurfProCredential } from './SurfProCredential';
import { surfStoreCopy } from './surfStoreCopy';

export function SurfStoreRewardCard({ reward }: { reward: SurfActiveStoreReward }) {
  const { locale } = useLocale();
  const copy = surfStoreCopy[locale];
  const benefit = copy.benefits[reward.id];
  const titleId = `surf-store-${reward.id}-title`;

  return (
    <>
      <article className={`surf-store-card surf-store-card--${reward.id}`} aria-labelledby={titleId}>
        <div className="surf-store-card__visual">
          <span className="surf-store-card__preview">{copy.preview}</span>
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
          <h2 id={titleId}>{benefit.name}</h2>
          <p className="surf-store-card__description">{benefit.description}</p>
          <button type="button" disabled>
            {copy.unavailable}
          </button>
        </div>
      </article>
    </>
  );
}
