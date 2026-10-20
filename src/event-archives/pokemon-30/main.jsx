import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownRight, Sparkles, Trophy } from 'lucide-react';
import { HubReturnButton } from '../../components/HubReturn/HubReturnButton';
import { archiveAssetUrl, hubArchiveUrl, installPokemonFonts } from '../shared/archiveAssets';
import { Pokemon30I18nProvider, usePokemon30I18n } from './original/src/i18n/Pokemon30I18n';
import { LanguageSelector } from './original/src/components/LanguageSelector';
import { PokemonPrizeStage } from './original/src/components/PokemonPrizeStage';
import { PokemonWinnerAnnouncement } from './original/src/components/PokemonWinnerAnnouncement';
import { PokemonTicketRuleCard } from './original/src/components/PokemonTicketRuleCard';
import { winnerAnnouncementMessages } from './original/src/i18n/winnerAnnouncementMessages';
import { POKEMON30_TICKET_RULES, formatPokemon30EventWindow } from './original/src/components/pokemon30Event';
import snapshot from '../data/pokemon-30.json';
import './original/src/components/pokemon30.css';
import './archive.css';

installPokemonFonts();
const announcement = { ...snapshot.announcement, ledger: { ...snapshot.announcement.ledger, downloadUrl: archiveAssetUrl(snapshot.announcement.ledger.downloadAsset) } };
const labels = {
  'zh-TW': { back: '返回 Hub', records: '查看得獎名單', archived: '活動回顧', ended: '活動已結束' },
  en: { back: 'Back to Hub', records: 'Meet the winners', archived: 'Event archive', ended: 'Event ended' },
  ko: { back: 'Hub로 돌아가기', records: '당첨자 보기', archived: '이벤트 아카이브', ended: '이벤트 종료' },
};
function PokemonArchive() {
  const { locale, t } = usePokemon30I18n();
  const copy = labels[locale];
  const [scrolled, setScrolled] = useState(window.scrollY > 28);
  useEffect(() => {
    const sync = () => setScrolled(window.scrollY > 28);
    window.addEventListener('scroll', sync, { passive: true });
    return () => window.removeEventListener('scroll', sync);
  }, []);
  return <main className={'pokemon30-page pokemon30-page--locale-' + locale}>
    <header className={'pokemon-header' + (scrolled ? ' pokemon-header--solid' : '')}>
      <a className="pokemon-header__brand pokemon-header__brand--wordmark" href="#top" aria-label={t('header.homeAria')}><img src={archiveAssetUrl('pokemon-30/src/assets/renaiss-logo-black.png')} alt="Renaiss" /></a>
      <nav aria-label={t('header.navigationAria')}><a href="#rules">{t('header.rules')}</a><a href="#winners">{winnerAnnouncementMessages[locale].navigation}</a></nav>
      <div className="pokemon-header__controls"><LanguageSelector /><HubReturnButton href={hubArchiveUrl(locale)} locale={locale}>{copy.back}</HubReturnButton></div>
    </header>
    <section className="pokemon-scroll-story pokemon-scroll-story--guest" id="top">
      <div className="pokemon-scroll-story__sticky">
        <div className="pokemon-scroll-story__copy">
          <div className="pokemon-kicker"><Sparkles size={15}/>{t('hero.kicker')}</div>
          <p className="pokemon-hero__eyebrow">{t('hero.date')}</p>
          <h1>{t('hero.titleLineOne')}<br/>{t('hero.titleLineTwo')}</h1>
          <p className="pokemon-hero__lede">{t('hero.lede')}</p>
          <div className="pokemon-hero__actions"><a className="pokemon-button pokemon-button--primary" href="#winners">{copy.records}<Trophy size={17}/></a><a className="pokemon-button pokemon-button--quiet" href="#rules">{t('hero.rulesCta')}<ArrowDownRight size={18}/></a></div>
          <div className="pokemon-hero__meta"><span className="pokemon-live-dot pokemon-live-dot--ended"/><strong>{copy.ended}</strong><span>{formatPokemon30EventWindow(locale, t)}<em className="pokemon-hero__timezone">{t('event.timeZone')}</em></span></div>
        </div>
        <div className="pokemon-scroll-story__prizes"><div className="pokemon-scroll-story__prize pokemon-scroll-story__prize--departing"><p className="pokemon-prize-label"><span>{t('prize.label')}</span><strong><span className="pokemon-prize-label__name">{t('prize.name')}</span></strong></p><PokemonPrizeStage label={t('prize.imageLabel')}/></div></div>
        <p className="pokemon-scroll-story__prompt" aria-hidden="true">{t('hero.guestScrollPrompt')}</p>
      </div>
    </section>
    <PokemonWinnerAnnouncement announcement={announcement}/>
    <section className="pokemon-rules" id="rules"><div className="pokemon-rules__intro"><h2>{t('rules.heading')}</h2><p>{t('rules.intro')}</p></div><ol className="pokemon-ticket-grid">{POKEMON30_TICKET_RULES.map((rule, index) => <PokemonTicketRuleCard key={rule.price} rule={rule} index={index}/>)}</ol></section>
    <footer className="pokemon-archive-footer"><span>RENAISS / POKÉMON 30TH · {copy.archived}</span><HubReturnButton href={hubArchiveUrl(locale)} locale={locale}>{copy.back}</HubReturnButton></footer>
  </main>;
}
const root = import.meta.hot
  ? (import.meta.hot.data.root ??= createRoot(document.getElementById('root')))
  : createRoot(document.getElementById('root'));
root.render(<Pokemon30I18nProvider><PokemonArchive/></Pokemon30I18nProvider>);
