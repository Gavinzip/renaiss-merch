import type { AppLocale } from '../../i18n/LocaleContext';
import { surfCampaignCopy } from './SurfCampaignCopy';
import { SurfCampaignArt } from './SurfCampaignArt';
import { HubWordmark } from './HubWordmark';
import { SurfLogo } from './SurfLogo';

export function SurfCampaignHero({ locale, onTasks, onRewards }: {
  locale: AppLocale; onTasks: () => void; onRewards: () => void;
}) {
  const copy = surfCampaignCopy[locale];
  return <section className="surf-page__hero" aria-labelledby="surf-campaign-title">
    <div className="surf-page__hero-copy">
      <div className="surf-page__brand-pair" data-surf-reveal="1"><span><HubWordmark /></span><i aria-hidden="true">×</i><span><SurfLogo />Surf</span></div>
      <div className="surf-page__eyebrow" data-surf-reveal="1"><span>{copy.eyebrow}</span><span className="surf-page__preview">{copy.stage}</span></div>
      <h1 id="surf-campaign-title" tabIndex={-1}><span data-surf-reveal="2">{copy.heroLineOne}</span><span data-surf-reveal="3">{copy.heroLineTwo}</span></h1>
      <p className="surf-page__hero-description" data-surf-reveal="4">{copy.description}</p>
      <div className="surf-page__hero-actions">
        <button className="surf-page__primary" data-surf-reveal="5" type="button" onClick={onTasks}>{copy.viewTasks}<span aria-hidden="true">↗</span></button>
        <button className="surf-page__text-button" data-surf-reveal="5" type="button" onClick={onRewards}>{copy.viewRewards}<span aria-hidden="true">↓</span></button>
      </div>
      <p className="surf-page__hero-footnote" data-surf-reveal="5">{copy.heroNote}</p>
    </div>
    <SurfCampaignArt locale={locale} />
  </section>;
}
