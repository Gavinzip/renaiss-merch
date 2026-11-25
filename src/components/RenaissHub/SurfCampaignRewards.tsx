import { surfCampaign } from '../../../shared/surf-campaign.js';
import type { AppLocale } from '../../i18n/LocaleContext';
import { surfCampaignCopy } from './SurfCampaignCopy';
import { surfCampaignAssets } from './surfCampaignAssets';

export function SurfCampaignRewards({ locale }: { locale: AppLocale }) {
  const copy = surfCampaignCopy[locale];
  const assets = surfCampaignAssets();
  return <section id="surf-campaign-rewards" className="surf-page__rewards" aria-labelledby="surf-rewards-title">
    <div className="surf-page__section-heading"><div><span className="surf-page__section-number" data-surf-reveal="0">{copy.rewardsSection}</span><h2 id="surf-rewards-title" tabIndex={-1} data-surf-reveal="1">{copy.rewards}</h2></div></div>
    <div className="surf-page__reward-grid">
      <article className="surf-page__reward surf-page__reward--box">
        <div className="surf-page__reward-media" data-surf-reveal="0" data-surf-motion="image"><img src={assets.box} alt={copy.boxAlt} width={800} height={800} loading="lazy" /></div>
        <div className="surf-page__reward-body"><div><h3 data-surf-reveal="1">{copy.box}</h3><p data-surf-reveal="2">{copy.boxDescription}</p></div><div className="surf-page__quantity" data-surf-reveal="3"><strong>{surfCampaign.plannedRewards.mysteryBoxes.toString().padStart(2, '0')}</strong><span>{copy.quantity}</span></div></div>
      </article>
      <article className="surf-page__reward surf-page__reward--pro">
        <div className="surf-page__reward-media" data-surf-reveal="1" data-surf-motion="image"><img src={assets.pro} alt={copy.proAlt} width={1360} height={850} loading="lazy" /></div>
        <div className="surf-page__reward-body"><div><h3 data-surf-reveal="1">{copy.trial}</h3><p data-surf-reveal="2">{copy.trialDescription}</p><a className="surf-page__product-link" data-surf-reveal="3" href={surfCampaign.surfUrl} target="_blank" rel="noopener noreferrer">{copy.proLearnMore}<span aria-hidden="true">↗</span></a></div><div className="surf-page__quantity" data-surf-reveal="3"><strong>{surfCampaign.plannedRewards.proMonthTrials}</strong><span>{copy.quantity}</span></div></div>
      </article>
    </div>
    <p className="surf-page__reward-note" data-surf-reveal="2">{copy.rewardNote}</p>
  </section>;
}
