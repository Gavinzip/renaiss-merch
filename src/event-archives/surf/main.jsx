import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence,motion,useReducedMotion } from 'motion/react';
import { LocaleProvider,useLocale } from '../../i18n/LocaleContext';
import { ArchiveHeader } from '../shared/ArchiveHeader';
import { ArchiveEntry } from '../shared/ArchiveEntry';
import { useArchiveEntrance } from '../shared/useArchiveEntrance';
import { HubWordmark } from '../../components/RenaissHub/HubWordmark';
import { SurfLogo } from '../../components/RenaissHub/SurfLogo';
import { SurfCampaignRewards } from '../../components/RenaissHub/SurfCampaignRewards';
import { SurfDrawBatchCard } from '../../components/RenaissHub/SurfDrawBatchCard';
import { SurfProCredential } from '../../components/SurfStoreRewards/SurfProCredential';
import { hubAssetUrl } from '../../lib/hubAssets';
import snapshot from '../data/surf.json';
import '../../components/RenaissHub/SurfCampaignPage.css';
import '../../components/RenaissHub/SurfDrawBatchScene.css';
import './archive.css';

const labels={'zh-TW':{ended:'2026.10.08 — 10.15 · 活動已結束',title:'得獎紀錄',boxes:'7 份 Mystery Box',pro:'20 份 Pro 月會員',proof:'抽獎紀錄',contract:'鏈上抽獎合約',duration:'1 個月'},en:{ended:'OCT 8 — OCT 15, 2026 · Event ended',title:'Winner records',boxes:'7 Mystery Boxes',pro:'20 Pro monthly memberships',proof:'Draw record',contract:'On-chain draw contract',duration:'1 MONTH'},ko:{ended:'2026.10.08 — 10.15 · 이벤트 종료',title:'당첨 기록',boxes:'Mystery Box 7개',pro:'Pro 1개월 이용권 20개',proof:'추첨 기록',contract:'온체인 추첨 계약',duration:'1개월'}};
function SurfArchive(){
  const entrance = useArchiveEntrance('[data-surf-reveal], .surf-archive-winners > h2, .surf-batch-prize-picker > *, .surf-batch-gallery > *, .event-archive-proof > *');
  const {locale,setLocale}=useLocale(),copy=labels[locale],reduced=useReducedMotion();
  const [kind,setKind]=useState('mystery-box');
  useEffect(()=>{document.title='Renaiss × Surf | '+copy.title;},[copy.title]);
  useEffect(()=>{if(location.hash==='#winners')document.getElementById('winners').scrollIntoView({behavior:'instant'});},[]);
  const winners=snapshot.winners.filter(winner=>snapshot.prizes[winner.slot].kind===kind);
  const art=kind==='mystery-box'?<img src={hubAssetUrl('surfBox')} alt=""/>:<SurfProCredential logoUrl={hubAssetUrl('surfLogo')} duration={copy.duration}/>;
  return <main ref={entrance} className="surf-page surf-draw-page surf-archive">
    <ArchiveHeader locale={locale} onLocale={setLocale} brand={<><HubWordmark/><b>×</b><SurfLogo/></>}/>
    <div className="event-archive-body">
      <ArchiveEntry className="event-archive-intro"><p>RENAISS × SURF</p><h1>Renaiss × Surf</h1><span>{copy.ended}</span></ArchiveEntry>
      <SurfCampaignRewards locale={locale}/>
      <section id="winners" className="surf-archive-winners" aria-labelledby="surf-archive-title">
        <h2 id="surf-archive-title" tabIndex={-1}>{copy.title}</h2>
        <div className="surf-batch-prize-picker" role="group" aria-label={copy.title}>{['mystery-box','surf-pro-month'].map(value=><button key={value} type="button" aria-pressed={kind===value} onClick={()=>setKind(value)}>{value==='mystery-box'?copy.boxes:copy.pro}<small>{value==='mystery-box'?'7 / 7':'20 / 20'}</small></button>)}</div>
        <motion.div layout transition={{duration:reduced?0:.3}}><AnimatePresence mode="wait" initial={false}><motion.div key={kind} className="surf-batch-scene" data-phase="revealed" data-kind={kind} initial={{opacity:.08,y:8}} animate={{opacity:1,y:0}} exit={{opacity:.08,y:-6}} transition={{duration:reduced?0:.22}}>
          <ol className="surf-batch-gallery" aria-label={kind==='mystery-box'?copy.boxes:copy.pro}>{winners.map((winner,index)=><SurfDrawBatchCard key={winner.slot} locale={locale} kind={kind} slot={winner.slot} column={index%4*2+1} winner={{...winner,participant:{name:winner.name}}} phase="revealed" shown turning={false} disabled={false} showContacts={false} prizeArtwork={art}/>)}</ol>
        </motion.div></AnimatePresence></motion.div>
      </section>
      <section className="event-archive-proof"><h2>{copy.proof}</h2><nav><a href={`https://bscscan.com/address/${snapshot.proof.source}#code`} target="_blank" rel="noreferrer">{copy.contract} ↗</a></nav></section>
    </div>
  </main>;
}
createRoot(document.getElementById('root')).render(<LocaleProvider><SurfArchive/></LocaleProvider>);
