import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, Ticket } from 'lucide-react';
import { HubReturnButton } from '../../components/HubReturn/HubReturnButton';
import { archiveAssetUrl, hubArchiveUrl } from '../shared/archiveAssets';
import { I18nProvider } from './original/src/app/i18n/I18nProvider';
import { useCampaignCopy } from './original/src/app/i18n/useCampaignCopy';
import { ViewMenu, LanguageSwitch } from './original/src/app/components/control-room/ControlRoom';
import { roundDefinitions, campaignMatches } from './original/src/app/data/worldCupCampaign';
import snapshot from '../data/football.json';
import './original/src/app/styles.css';
import './archive.css';

const FootballWinners = lazy(() => import('./FootballWinners'));
const rounds = roundDefinitions.filter(round => snapshot.roundSnapshots.some(item => item.roundId === round.id));
const matches = campaignMatches.filter(match => snapshot.winners.some(winner => winner.matchId === match.id));
const data = {...snapshot,
  winners:snapshot.winners.map(winner => ({...winner, profile:{...winner.profile, ...(winner.profile.avatarAsset ? {avatarUrl:archiveAssetUrl(winner.profile.avatarAsset)} : {})}})),
  roundSnapshots:snapshot.roundSnapshots.map(round => ({...round, proof:{...round.proof, ledgerDownloadUrl:archiveAssetUrl(round.ledgerAsset)}}))};
const labels = {
  'zh-Hant': { back:'返回 Hub', ended:'活動已結束', home:'活動首頁', winners:'獎品與中獎名單', records:'回看獎品與得獎紀錄', loading:'正在載入原活動展示…', unavailable:'活動影片載入失敗，請重新整理。' },
  en: { back:'Back to Hub', ended:'Event ended', home:'Event home', winners:'Prizes & winners', records:'Explore prizes & winners', loading:'Loading the event presentation…', unavailable:'The event film could not load. Please refresh.' },
  ko: { back:'Hub로 돌아가기', ended:'이벤트 종료', home:'이벤트 홈', winners:'경품 및 당첨자', records:'경품 및 당첨 기록 보기', loading:'이벤트 전시 로딩 중…', unavailable:'이벤트 영상을 로드하지 못했습니다. 새로고침해 주세요.' },
};
function FootballHome({copy, onWinners}) {
  const video = useRef(null);
  const [ready,setReady] = useState(false);
  const [issue,setIssue] = useState(false);
  const heroImage = archiveAssetUrl('football/src/app/assets/hero-world-cup-clean.webp');
  const background = archiveAssetUrl('football/src/app/assets/' + (matchMedia('(max-width: 760px)').matches ? 'Background.mobile.mp4' : 'Background.web.mp4'));
  useEffect(() => { const element=video.current; return () => {element.pause(); element.removeAttribute('src'); element.load();}; }, []);
  return <section className={'home-room is-media-ready ' + (ready ? 'is-video-ready' : 'is-video-poster')} aria-label={copy.home}>
    <div className="home-video-backdrop" aria-hidden="true"><img className="home-video-backdrop__poster" src={heroImage} alt=""/><video className="home-video-backdrop__video" ref={video} src={background} poster={heroImage} autoPlay muted playsInline loop preload="auto" onLoadedData={() => setReady(true)} onError={() => setIssue(true)}/></div>
    <figure className="hero-stage"><figcaption className="hero-stage__content"><section className="hero-copy"><h1>Renaiss<br/>{copy.title}</h1><p>{copy.body.split('\n').map((line,index) => <span key={line}>{index>0 && <br/>}{line}</span>)}</p><menu className="hero-actions" aria-label={copy.records}><li><button className="hero-action hero-action--primary renaiss-metal-button is-light" type="button" onClick={onWinners}><Ticket size={18}/>{copy.records}<ArrowRight size={17}/></button></li><li><span className="football-archive-status">{copy.ended}</span></li></menu></section></figcaption></figure>
    {issue && <p className="football-archive-media-error" role="alert">{copy.unavailable}</p>}
  </section>;
}
function FootballArchive() {
  const {locale, t} = useCampaignCopy();
  const copy = labels[locale];
  const [view,setView] = useState(window.location.hash==='#winners' ? 'winners' : 'home');
  const [activeRound,setActiveRound] = useState('final');
  useEffect(() => {const sync=()=>{setView(window.location.hash==='#winners'?'winners':'home');window.scrollTo(0,0);};window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
  function navigate(next) { window.location.hash = next==='winners' ? 'winners' : 'top'; }
  return <main className="control-room football-archive" data-view={view}>
    <header className="control-header" aria-label={t('nav.aria')}>
      <button type="button" className="brand-lockup" onClick={()=>navigate('home')} aria-label={t('brand.homeAria')}><img src={archiveAssetUrl('football/src/app/assets/renaiss-logo-mark.webp')} alt=""/><span><strong>Renaiss</strong><small>WORLD CUP</small></span></button>
      <ViewMenu activeViewId={view} onSelectView={navigate} t={t} views={[{id:'home'},{id:'winners'}]}/>
      <LanguageSwitch/>
      <div className="header-wallet hub-return-slot"><HubReturnButton href={hubArchiveUrl(locale)} locale={locale}>{copy.back}</HubReturnButton></div>
    </header>
    <section className={'room-shell'+(view==='home'?' is-home':'')} id="top">
      {view==='home' ? <FootballHome copy={{...copy,title:t('home.title').replace(/^Renaiss\s*/,''),body:t('home.body')}} onWinners={()=>navigate('winners')}/> : <>
        <Suspense fallback={<p className="football-archive-loading" role="status">{copy.loading}</p>}><FootballWinners activeRoundId={activeRound} onSelectRound={setActiveRound} data={data} rounds={rounds} matches={matches}/></Suspense>
      </>}
    </section>
  </main>;
}
const root = import.meta.hot
  ? (import.meta.hot.data.root ??= createRoot(document.getElementById('root')))
  : createRoot(document.getElementById('root'));
root.render(<I18nProvider><FootballArchive/></I18nProvider>);
