import {useEffect,useState} from 'react';
import {ExternalLink,Fingerprint,ShieldCheck} from 'lucide-react';
import type {ProofOverview} from '../../../shared/public-proof/types';
import type {MatchSnapshotRecord} from '../../../shared/public-proof/worlds/match-types';
import './match-commitment.css';

const words={
 'zh-TW':{title:'本場名冊，先行存證。',body:'先核對名冊與鏈上承諾；開獎之後，再核對完整亂數證明與中獎票券。',tickets:'合格票券',root:'Merkle Root',empty:'本場沒有合格票券，不產生得獎者。',one:'本場僅 1 張合格票券；開獎仍須完成相同的承諾與證明流程。',pending:'名冊已固定，鏈上存證尚未完成最終確認。',ready:'網站已公布存證，請在此獨立核對。',run:'核對鏈上存證',running:'正在獨立讀取鏈上紀錄…',verified:'已獨立核對：名冊內容、Root、票數、公鑰與最終確認的鏈上交易一致。',download:'下載本場名冊',chain:'查看鏈上存證',full:'查看完整開獎證明',boundary:'名冊存證不等於已開獎，也不證明原始投票資料沒有遺漏。',failed:'存證未通過獨立驗證，請核對資料來源與公開 RPC。',conflict:'官方賽果有待核對的異動，開獎已暫停。',review:'原存證交易等待人工核對，尚未完成鏈上最終確認。'},
 en:{title:'This roster. Committed early.',body:'Check the roster against its chain commitment. After the draw, verify the randomness proof and winning ticket.',tickets:'Eligible tickets',root:'Merkle root',empty:'No eligible tickets. This match has no winner.',one:'One eligible ticket. The same commitment and proof checks still apply.',pending:'The roster is fixed; chain finality is still pending.',ready:'A commitment is published. Verify it independently here.',run:'Verify chain commitment',running:'Reading chain evidence independently…',verified:'Verified independently: roster, root, count and key match the finalized transaction.',download:'Download match roster',chain:'View chain commitment',full:'View complete draw proof',boundary:'A roster commitment is not a draw result and does not prove that source votes were complete.',failed:'Independent verification failed. Check the source and approved public RPC.',conflict:'The official result changed. Drawing is suspended pending review.',review:'The original transaction requires review. Chain finality is not yet confirmed.'},
 ko:{title:'경기 명단을 미리 확정합니다.',body:'명단과 온체인 커밋을 확인하세요. 추첨 후에는 난수 증명과 당첨 티켓을 검증합니다.',tickets:'적격 티켓',root:'Merkle Root',empty:'적격 티켓이 없어 당첨자가 없습니다.',one:'적격 티켓이 1장입니다. 동일한 커밋과 증명 검증을 거칩니다.',pending:'명단은 고정되었으며 온체인 최종 확정을 기다립니다.',ready:'공개된 커밋을 여기서 독립적으로 검증하세요.',run:'온체인 커밋 검증',running:'온체인 기록을 독립적으로 읽는 중…',verified:'명단, Root, 티켓 수 및 공개키가 최종 확정된 거래와 일치합니다.',download:'경기 명단 다운로드',chain:'온체인 기록 보기',full:'전체 추첨 증명 보기',boundary:'명단 커밋은 추첨 결과가 아니며 원본 투표의 완전성을 보증하지 않습니다.',failed:'독립 검증에 실패했습니다. 출처와 공개 RPC를 확인하세요.',conflict:'공식 결과에 변경이 있어 추첨이 보류되었습니다.',review:'기존 거래의 수동 확인이 필요하며 온체인 최종 확정 전입니다.'},
};
export function MatchCommitmentPanel({matchId,snapshotHash,expectedTransaction,overview,locale}:{matchId:string;snapshotHash:string;expectedTransaction?:string;overview:ProofOverview;locale:keyof typeof words}){
 const copy=words[locale], [record,setRecord]=useState<MatchSnapshotRecord|null>(null),[error,setError]=useState(''),[verified,setVerified]=useState(false),[busy,setBusy]=useState(false);
 const endpoint=`/api/public-proofs/worlds-2026/matches/${matchId}/snapshot?${new URLSearchParams({snapshotHash})}`;
 useEffect(()=>{const controller=new AbortController();setRecord(null);setError('');setVerified(false);
  void(async()=>{try{const r=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])});if(!r.ok)throw new Error(copy.failed);
    const value=await r.json() as MatchSnapshotRecord;
    if(value.snapshot?.matchId!==matchId||!value.snapshot.ledger||!Number.isSafeInteger(value.commitment?.ticketCount)||value.commitment.snapshotHash.toLowerCase()!==snapshotHash.toLowerCase()||r.headers.get('x-snapshot-sha256')!==value.commitment.snapshotHash||expectedTransaction&&value.transactionHash?.toLowerCase()!==expectedTransaction.toLowerCase())throw new Error(copy.failed);
    if(!controller.signal.aborted)setRecord(value);
   }catch{if(!controller.signal.aborted)setError(copy.failed);}})();return()=>controller.abort();
 },[endpoint,matchId,snapshotHash,expectedTransaction,copy.failed]);
 async function verify(){if(!record||busy)return;setBusy(true);setVerified(false);setError('');let provider;
  try{
   const [{FetchRequest,JsonRpcProvider},{inspectMatchCommitment},{matchCommitmentFor},{canonical,same}]=await Promise.all([import('ethers'),import('../../../shared/public-proof/worlds/match-chain.mjs'),import('../../../shared/public-proof/worlds/match-snapshot.mjs'),import('../../../shared/public-proof/worlds/protocol.mjs')]);
   const authority=overview.authorities.find(a=>a.configured&&a.chainId===record.authority.chainId&&same(a.contract,record.authority.contract)&&same(a.runtimeHash,record.authority.runtimeHash));
   if(!authority?.publicRpc||canonical(matchCommitmentFor(record.snapshot))!==canonical(record.commitment))throw new Error(copy.failed);
   const request=new FetchRequest(authority.publicRpc);request.timeout=15000;provider=new JsonRpcProvider(request,undefined,{batchMaxCount:1});
   const result=await inspectMatchCommitment(provider,authority,record.snapshot,{transactionHash:record.transactionHash??undefined});
   if(result.status!=='finalized'||!record.chain||canonical(result.chain)!==canonical(record.chain))throw new Error(copy.failed);
   setVerified(true);
  }catch{setError(copy.failed);}finally{provider?.destroy();setBusy(false);}
 }
 const published=overview.rounds.find(r=>r.stage===record?.snapshot.stage&&r.status==='published');
 return <section className="vf-match-snapshot vf-info-card" id="match-commitment" aria-label={copy.title}>
  <div className="vf-section-top"><span>{matchId.toUpperCase()} / EARLY ROSTER COMMITMENT</span><Fingerprint size={20}/></div>
  <h2>{copy.title}</h2><p>{copy.body}</p>
  {record?<><p role="status">{record.status==='blocked'?copy.conflict:record.status==='review_required'?copy.review:record.status==='finalized'?copy.ready:copy.pending}</p>
   <div className="vf-match-facts"><div><span>{copy.tickets}</span><strong>{record.commitment.ticketCount}</strong></div><div><span>{copy.root}</span><code>{record.commitment.root}</code></div></div>
   {record.commitment.ticketCount===0?<p>{copy.empty}</p>:record.commitment.ticketCount===1?<p>{copy.one}</p>:null}
   {record.chain?<p><time dateTime={record.chain.committedAt}>{new Date(record.chain.committedAt).toLocaleString(locale,{timeZone:'Asia/Taipei'})} UTC+8</time></p>:null}
   <button className="vf-step-action" type="button" onClick={()=>void verify()} disabled={busy||!record.chain}>{busy?copy.running:copy.run}<ShieldCheck size={16}/></button>
   {verified?<p className="vf-match-verified" role="status">{copy.verified}</p>:null}
   <div className="vf-links"><a href={endpoint+'&download=1'}>{copy.download}</a>
    {record.transactionHash&&record.chain?<a href={`https://${record.chain.chainId===97?'testnet.':''}bscscan.com/tx/${record.transactionHash}`} target="_blank" rel="noopener noreferrer">{copy.chain}<ExternalLink size={13}/></a>:null}
    {published?.bundleHash?<a href={'/verify?'+new URLSearchParams({event:'worlds-2026',stage:published.stage,bundleHash:published.bundleHash,lang:locale})}>{copy.full}</a>:null}
   </div><p className="vf-disclaimer">{copy.boundary}</p></>:null}
  {error?<p className="vf-error" role="alert">{error}</p>:null}
 </section>;
}
