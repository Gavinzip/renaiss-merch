import type { AppLocale } from '../../i18n/LocaleContext';
import { campaignUrl, featuredCampaignCopy, type FeaturedCampaign } from '../../config/hubCampaigns';
import { HubLogo } from './HubLogo';
import { HubMotionText } from './HubMotionText';
import './HubFeaturedCampaign.css';
import './SurfQuestBrand.css';

export function HubFeaturedCampaign({ campaign, locale, preview = false, standalone = false }: {
  campaign: Extract<FeaturedCampaign, { kind: 'external' }>;
  locale: AppLocale;
  preview?: boolean;
  standalone?: boolean;
}) {
  const labels = featuredCampaignCopy[locale];
  const copy = campaign.copy[locale];
  const href = campaignUrl(campaign, locale);
  return <article className="renaiss-hub__card hub-featured-campaign" id={preview ? undefined : 'portal-partner'}>
    {!standalone ? <div className="renaiss-hub__card-heading">
      <span data-hub-enter className="hub-widget-title"><HubMotionText>{labels.label}</HubMotionText></span>
      <a data-hub-enter className="hub-featured-campaign__details" href={href} target="_blank" rel="noopener noreferrer">{labels.details}<span aria-hidden="true"> ↗</span></a>
    </div> : null}
    <div className="hub-featured-campaign__brand">
      <span data-hub-enter className="hub-featured-campaign__emblem" aria-hidden="true"><HubLogo /></span>
      <h2 data-hub-enter>{standalone ? campaign.title : <a className="hub-title-action" href={href} target="_blank" rel="noopener noreferrer"><HubMotionText>{campaign.title}</HubMotionText></a>}</h2>
    </div>
    <p data-hub-enter className="hub-featured-campaign__description">{copy.description}</p>
    <ol className="hub-featured-campaign__steps">
      {copy.steps.map((step, index) => <li data-hub-enter key={step}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h3>{step}</h3></li>)}
    </ol>
    <a data-hub-enter className="hub-featured-campaign__action" href={href} target="_blank" rel="noopener noreferrer"><span>{labels.enter}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M5 4h7v7" /></svg></a>
    <footer data-hub-enter className="hub-featured-campaign__footer"><p>{copy.deadline}</p><small>{labels.notice}</small></footer>
  </article>;
}
