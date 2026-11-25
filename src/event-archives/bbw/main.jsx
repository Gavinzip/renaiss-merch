import { useEffect, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { LocaleProvider, useLocale } from '../../i18n/LocaleContext';
import { ArchiveHeader } from '../shared/ArchiveHeader';
import { useArchiveEntrance } from '../shared/useArchiveEntrance';
import { communityArchiveAssetUrl } from '../shared/communityArchiveAssets';
import { bbwArchive, bbwArchiveMedia, bbwArchiveWinners } from './archiveData';
import { ArchiveTickets, useArchiveTicketPrints } from './ArchiveTickets';
import './archive.css';

const labels = {
  'zh-TW': {
    title:'下一站，曼谷。', ended:'社群抽獎已揭曉', venue:'2026.11.28 — 11.29 · 曼谷 QSNCC',
    intro:'Renaiss × Four.meme 攜手前往 BBW Bangkok。社群以創作投稿參與活動，將收藏與交流帶到曼谷。',
    travel:'得獎赴曼谷，機票＋住宿補助最高', remote:'不赴曼谷可領', alternative:'兩種獎勵擇一，依原活動規則。',
    winners:'得獎名單', count:n=>`${n} 位得獎者`, ticket:'票號', wins:n=>`中獎 ${n} 次`, proof:'抽獎證明', download:'下載原始證明', chain:'查看鏈上紀錄',
    verified:'ECVRF 與鏈上紀錄已核對', loading:'正在準備原活動獎勵卡…', error:'原活動獎勵卡載入失敗，請重試。', retry:'重新載入',
    note:'此卡是活動旅遊獎勵憑證，不是機票開票或飯店訂房確認單。',
  },
  en: {
    title:'Next stop, Bangkok.', ended:'Community draw revealed', venue:'NOV 28–29, 2026 · QSNCC, Bangkok',
    intro:'Renaiss and Four.meme bring community creations, collecting and conversation together at BBW Bangkok.',
    travel:'Flight + hotel support for winners attending, up to', remote:'For winners not travelling', alternative:'Choose one reward, under the original campaign rules.',
    winners:'Winners', count:n=>`${n} winners`, ticket:'Ticket', wins:n=>`Won ${n} times`, proof:'Draw proofs', download:'Download original proof', chain:'View on-chain records',
    verified:'ECVRF and on-chain records checked', loading:'Preparing the original award cards…', error:'The original award cards could not load. Please retry.', retry:'Retry',
    note:'This card is an event travel reward certificate, not an airline ticket or hotel booking confirmation.',
  },
  ko: {
    title:'다음 목적지, 방콕.', ended:'커뮤니티 추첨 결과 공개', venue:'2026.11.28 — 11.29 · 방콕 QSNCC',
    intro:'Renaiss와 Four.meme가 BBW Bangkok에서 커뮤니티의 창작과 수집, 교류를 연결합니다.',
    travel:'방콕 방문 당첨자의 항공권 + 숙박 지원, 최대', remote:'방콕을 방문하지 않는 당첨자', alternative:'기존 이벤트 규칙에 따라 두 보상 중 하나를 선택합니다.',
    winners:'당첨자 명단', count:n=>`당첨자 ${n}명`, ticket:'티켓', wins:n=>`${n}회 당첨`, proof:'추첨 증명', download:'원본 증명 다운로드', chain:'온체인 기록 보기',
    verified:'ECVRF 및 온체인 기록 확인', loading:'기존 리워드 카드 준비 중…', error:'리워드 카드를 불러오지 못했습니다. 다시 시도해 주세요.', retry:'다시 시도',
    note:'이 카드는 이벤트 여행 리워드 증서이며 항공권 또는 호텔 예약 확인서가 아닙니다.',
  },
};

function BbwArchive() {
  const {locale,setLocale} = useLocale(), copy = labels[locale];
  const prints = useArchiveTicketPrints(locale);
  const root = useArchiveEntrance('.event-archive-intro > *, .bbw-archive-hero, .bbw-archive-prizes > *, .bbw-archive-winners__heading > *, .event-archive-proof > *');
  useEffect(() => { document.title = 'Renaiss × Four.meme · BBW | ' + copy.winners; }, [copy.winners]);
  useEffect(() => {
    const url = new URL(location.href);
    if (url.searchParams.has('round')) { url.searchParams.delete('round'); history.replaceState(history.state,'',url); }
  }, []);
  // Anchor after the original printed frames establish the document's height.
  useLayoutEffect(() => {
    if (prints.status === 'ready' && location.hash === '#winners') document.getElementById('winners').scrollIntoView({behavior:'instant'});
  }, [prints.status]);
  return <main ref={root} className="bbw-archive">
    <ArchiveHeader locale={locale} onLocale={setLocale} brand={<><img src={bbwArchiveMedia.renaissOnLight} alt="Renaiss"/><b>×</b><img className="bbw-archive-partner" src={bbwArchiveMedia.fourmemeOnLight} alt="Four.meme"/></>}/>
    <div className="event-archive-body">
      <div className="event-archive-intro"><p>RENAISS × FOUR.MEME / BBW 2026</p><h1>{copy.title}</h1><span>{copy.venue}</span><p className="bbw-archive-status">{copy.ended}</p></div>
      <div className="bbw-archive-hero"><img src={bbwArchiveMedia.venue} alt="QSNCC Bangkok" width={2560} height={1440}/><p>{copy.intro}</p></div>
      <section className="bbw-archive-prizes"><div><p>{copy.travel}</p><strong>1,000 <small>USDT</small></strong></div><span aria-hidden="true">/</span><div><p>{copy.remote}</p><strong>300 <small>USDT</small></strong></div><p>{copy.alternative}</p></section>
      <section id="winners" className="bbw-archive-winners" aria-labelledby="bbw-archive-winners-title">
        <div className="bbw-archive-winners__heading"><h2 id="bbw-archive-winners-title">{copy.count(bbwArchiveWinners.length)}</h2></div>
        {prints.status !== 'ready'
          ? <div className="bbw-archive-loading" role={prints.status==='error'?'alert':'status'}><p>{prints.status==='error'?copy.error:copy.loading}</p>{prints.status==='error'&&<button type="button" onClick={prints.retry}>{copy.retry}</button>}</div>
          : <ArchiveTickets faces={prints.faces} copy={copy}/>}
        <p className="bbw-archive-note">{copy.note}</p>
      </section>
      <section className="event-archive-proof">
        <h2>{copy.proof}</h2><p>{copy.verified}</p>
        <nav>{[...bbwArchive.rounds].reverse().map((entry,index)=><a key={entry.bundleHash} href={communityArchiveAssetUrl(entry.proofAsset)} download={`bbw-draw-proof-${index===0?'a':'b'}.json`}>{copy.download} {index===0?'A':'B'} ↧</a>)}<a href={'https://bscscan.com/address/'+bbwArchive.authority.contract+'#events'} target="_blank" rel="noreferrer">{copy.chain} ↗</a></nav>
      </section>
    </div>
  </main>;
}
createRoot(document.getElementById('root')).render(<LocaleProvider><BbwArchive/></LocaleProvider>);
