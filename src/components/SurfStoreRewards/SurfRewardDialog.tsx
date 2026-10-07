import type { SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { surfCampaign } from '../../../shared/surf-campaign.js';
import { useLocale } from '../../i18n/LocaleContext';
import type { useModalDialog } from '../../hooks/useModalDialog';
import { surfPreviewLogoUrl } from '../RenaissHub/hubPreviewAssets';
import { surfStoreCopy } from './surfStoreCopy';
import { SurfRewardFacts } from './SurfRewardFacts';

type SurfRewardDialogProps = { dialog: ReturnType<typeof useModalDialog>; reward: SurfActiveStoreReward };

export function SurfRewardDialog({ dialog, reward }: SurfRewardDialogProps) {
  const { locale } = useLocale();
  const copy = surfStoreCopy[locale];
  const benefit = copy.benefits[reward.id];
  const titleId = `surf-reward-${reward.id}-dialog-title`;
  const descriptionId = `surf-reward-${reward.id}-dialog-description`;
  return (
    <dialog
      ref={dialog.ref}
      className={`surf-reward-dialog t-modal${dialog.phase === 'open' ? ' is-open' : dialog.phase === 'closing' ? ' is-closing' : ''}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); dialog.close(); }}
      onClick={event => { if (event.target === event.currentTarget) dialog.close(); }}
    >
      <div className="surf-reward-dialog__toolbar">
        <span>SBT SHOP / SURF</span>
        <button type="button" onClick={dialog.close} aria-label={copy.close}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </div>
      <div className="surf-reward-dialog__content">
        <header className="surf-reward-dialog__intro">
          <img src={surfPreviewLogoUrl()} width={400} height={400} alt="Surf AI" />
          <div>
            <p>RENAISS × SURF</p>
            <h2 id={titleId} tabIndex={-1}>{benefit.name}</h2>
            <p id={descriptionId} className="surf-reward-dialog__description">{copy.dialogDescription}</p>
          </div>
        </header>
        <article className={`surf-reward surf-reward--${reward.id}`}>
          <div className="surf-reward__visual" aria-hidden="true"><span>{benefit.label}</span><strong>{benefit.value}</strong><span>{benefit.unit}</span></div>
          <div className="surf-reward__body">
            <p>{benefit.description}</p>
            <SurfRewardFacts reward={reward} />
            <button type="button" disabled>{copy.unavailable}</button>
          </div>
        </article>
      </div>
      <footer className="surf-reward-dialog__footer"><p>{copy.note}</p><a href={surfCampaign.surfUrl} target="_blank" rel="noreferrer">{copy.site} <span aria-hidden="true">↗</span></a></footer>
    </dialog>
  );
}
