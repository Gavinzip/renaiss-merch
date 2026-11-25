import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence,motion,useReducedMotion } from 'motion/react';
import { ArchiveHeader } from '../shared/ArchiveHeader';
import { useArchiveEntrance } from '../shared/useArchiveEntrance';
import { communityArchiveAssetUrl as asset } from '../shared/communityArchiveAssets';
import { I18nProvider,useI18n } from './original/src/i18n/I18nProvider';
import { WinnersShowcase } from './original/src/features/renaiss/winners/WinnersShowcase';
import snapshot from '../data/worlds-2026.json';
import './original/src/features/renaiss/football-competition-toolbar.css';
import './archive.css';

const labels={'zh-Hant':{title:'Renaiss Worlds 2026',ended:'2026.11.02 — 11.15 · 活動已結束',records:'獎品與得獎紀錄',stage:'賽事階段',proof:'抽獎證明',download:'下載原始抽獎證明',transaction:'鏈上請求紀錄'},en:{title:'Renaiss Worlds 2026',ended:'NOV 2 — NOV 15, 2026 · Event ended',records:'Prizes & winners',stage:'Tournament stage',proof:'Draw proof',download:'Download original draw proof',transaction:'On-chain request'},ko:{title:'Renaiss Worlds 2026',ended:'2026.11.02 — 11.15 · 이벤트 종료',records:'경품 및 당첨 기록',stage:'대회 단계',proof:'추첨 증명',download:'원본 추첨 증명 다운로드',transaction:'온체인 요청 기록'}};
const teams=snapshot.teams.map(team=>({...team,logoUrl:asset(team.logoAsset)}));
const readStage=()=>{const stage=new URLSearchParams(location.search).get('stage');return snapshot.stages.some(item=>item.id===stage)?stage:'quarter';};
function WorldsArchive(){
  const entrance = useArchiveEntrance('.event-archive-intro > *, .worlds-competition-toolbar, .event-archive-proof > *');
  const {locale,setLocale,text}=useI18n(),copy=labels[locale],appLocale=locale==='zh-Hant'?'zh-TW':locale,reduced=useReducedMotion();
  const [active,setActive]=useState(readStage);
  const stage=snapshot.stages.find(item=>item.id===active),round=snapshot.rounds.find(item=>item.stage===active);
  useEffect(()=>{document.title=copy.title+' | '+copy.records;},[copy.title,copy.records]);
  useEffect(()=>{const sync=()=>setActive(readStage());window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
  const proofLinks=new Map(snapshot.matches.map(match=>[match.id,'#proof-'+match.stage]));
  function selectStage(id){if(id===active)return;const url=new URL(location.href);url.searchParams.set('stage',id);url.hash='winners';history.pushState(history.state,'',url);setActive(id);}
  return <main ref={entrance} className="worlds-control-room worlds-archive">
    <ArchiveHeader locale={appLocale} onLocale={value=>setLocale(value==='zh-TW'?'zh-Hant':value)} brand={<img src={asset('worlds-2026/wordmark.webp')} alt="Renaiss"/>}/>
    <div className="event-archive-body activity-winners worlds-winners-page">
      <div className="event-archive-intro"><p>LEAGUE OF LEGENDS / WORLDS 2026</p><h1>{copy.title}</h1><span>{copy.ended}</span></div>
      <section id="winners" className="worlds-competition-toolbar" data-presentation="football" aria-label={copy.stage}>
        <div className="round-simulator is-rail-only"><ol className="round-switch round-switch--read-only" aria-label={copy.stage}>{snapshot.stages.map(item=><li key={item.id} className={'round-switch__item is-inspectable is-scheduled has-pending '+(item.id===active?'is-active ':'')+(item.id==='final'?'is-final-round':'')} aria-current={item.id===active?'step':undefined}>
          <button className="round-switch__stage" type="button" aria-pressed={item.id===active} onClick={()=>selectStage(item.id)}><span className="round-switch__label">{text(item.name)}</span><strong className="round-switch__metric"><span>{item.matchCount}</span><small>{locale==='en'?(item.matchCount===1?'match':'matches'):locale==='ko'?'경기':'場 / 輪'}</small></strong><span className="round-switch__detail">{item.dates}</span><span className="round-switch__track" aria-hidden="true"/></button>
        </li>)}</ol></div>
      </section>
      <motion.div layout transition={{duration:reduced?0:.3}}><AnimatePresence mode="wait" initial={false}><motion.div key={active} initial={{opacity:.08,y:8}} animate={{opacity:1,y:0}} exit={{opacity:.08,y:-6}} transition={{duration:reduced?0:.2}}>
        <WinnersShowcase activeStage={active} stages={snapshot.stages} matches={snapshot.matches} prizes={snapshot.prizes} teams={teams} draws={snapshot.draws} proofLinks={proofLinks}/>
        <section className="event-archive-proof" id={'proof-'+active}><h2>{text(stage.name)} · {copy.proof}</h2><nav><a href={asset(round.proofAsset)} download={`worlds-2026-${active}-proof.json`}>{copy.download} ↧</a><a href={'https://bscscan.com/tx/'+round.requestTx} target="_blank" rel="noreferrer">{copy.transaction} ↗</a></nav></section>
      </motion.div></AnimatePresence></motion.div>
    </div>
  </main>;
}
createRoot(document.getElementById('root')).render(<I18nProvider><WorldsArchive/></I18nProvider>);
