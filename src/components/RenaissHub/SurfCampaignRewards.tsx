import { surfCampaign } from '../../../shared/surf-campaign.js';
import type { AppLocale } from '../../i18n/LocaleContext';
import { surfCampaignCopy } from './SurfCampaignCopy';
import { surfCampaignAssets } from './surfCampaignAssets';

export function SurfCampaignRewards({ locale }: { locale: AppLocale }) {
  const copy = surfCampaignCopy[locale];
  const assets = surfCampaignAssets();
  return <section id="surf-campaign-rewards" className="surf-page__rewards" aria-labelledby="surf-rewards-title">
    <div className="surf-page__section-heading"><div><span className="surf-page__section-number" data-surf-reveal="0">01 / REWARDS</span><h2 id="surf-rewards-title" tabIndex={-1} data-surf-reveal="1">{copy.rewards}</h2></div><span className="surf-page__section-note" data-surf-reveal="2">{copy.planned}</span></div>
    <div className="surf-page__reward-grid">
      <article className="surf-page__reward surf-page__reward--box">
        <div className="surf-page__reward-media" data-surf-reveal="0" data-surf-motion="image"><img src={assets.box} alt={copy.boxAlt} width={800} height={800} loading="lazy" /><span aria-hidden="true">MYSTERY BOX</span></div>
        <div className="surf-page__reward-body"><div><span className="surf-page__reward-kicker" data-surf-reveal="0">01 / SURF ORIGINAL</span><h3 data-surf-reveal="1">{copy.box}</h3><p data-surf-reveal="2">{copy.boxDescription}</p></div><div className="surf-page__quantity" data-surf-reveal="3"><strong>{surfCampaign.plannedRewards.mysteryBoxes.toString().padStart(2, '0')}</strong><span>{copy.quantity}</span></div></div>
      </article>
      <article className="surf-page__reward surf-page__reward--pro">
        <div className="surf-page__reward-media" data-surf-reveal="1" data-surf-motion="image"><img src={assets.pro} alt={copy.proAlt} width={1360} height={850} loading="lazy" /><span className="surf-page__product-caption">{copy.productView}</span></div>
        <div className="surf-page__reward-body"><div><span className="surf-page__reward-kicker" data-surf-reveal="0">02 / 1 MONTH</span><h3 data-surf-reveal="1">{copy.trial}</h3><p data-surf-reveal="2">{copy.trialDescription}</p><ul className="surf-page__pro-features">{copy.proFeatures.map((feature, index) => <li data-surf-reveal={index + 2} key={feature}>{feature}</li>)}</ul><a className="surf-page__product-link" data-surf-reveal="4" href={surfCampaign.surfUrl} target="_blank" rel="noopener noreferrer">{copy.proLearnMore}<span aria-hidden="true">↗</span></a></div><div className="surf-page__quantity" data-surf-reveal="3"><strong>{surfCampaign.plannedRewards.proMonthTrials}</strong><span>{copy.quantity}</span></div></div>
      </article>
    </div>
    <p className="surf-page__reward-note" data-surf-reveal="2">{copy.rewardNote}</p>
  </section>;
}
