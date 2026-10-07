import type { SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { useLocale } from '../../i18n/LocaleContext';
import { useModalDialog } from '../../hooks/useModalDialog';
import { surfPreviewLogoUrl } from '../RenaissHub/hubPreviewAssets';
import { surfCampaignAssets } from '../RenaissHub/surfCampaignAssets';
import { SurfRewardDialog } from './SurfRewardDialog';
import { surfStoreCopy } from './surfStoreCopy';

export function SurfStoreRewardCard({ reward }: { reward: SurfActiveStoreReward }) {
  const { locale } = useLocale();
  const copy = surfStoreCopy[locale];
  const benefit = copy.benefits[reward.id];
  const dialog = useModalDialog();
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
              <img src={surfPreviewLogoUrl()} alt="" width={400} height={400} />
              <strong>Surf Pro</strong>
              <span>{benefit.label}</span>
              <div>{benefit.value}</div>
            </div>
          )}
        </div>
        <div className="surf-store-card__body">
          <p className="surf-store-card__edition">RENAISS × SURF / {benefit.label}</p>
          <h2 id={titleId}>{benefit.name}</h2>
          <p className="surf-store-card__description">{benefit.description}</p>
          <button onClick={dialog.open} type="button" aria-haspopup="dialog">
            {benefit.view}<span aria-hidden="true">↗</span>
          </button>
        </div>
      </article>
      <SurfRewardDialog dialog={dialog} reward={reward} />
    </>
  );
}
