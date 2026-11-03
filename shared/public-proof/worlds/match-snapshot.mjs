import {AbiCoder,concat,getBytes,hexlify,keccak256,toUtf8Bytes} from 'ethers';
import {keccak_256} from '@noble/hashes/sha3.js';
import {canonical,digest,hash32,matchKeyFor,requireThat,same} from './protocol.mjs';
import {POLICY} from './draw-policy.mjs';

export const MATCH_PROTOCOL='renaiss-worlds-match-roster-v1';
export const MATCH_PROTOCOL_HASH=keccak256(toUtf8Bytes(MATCH_PROTOCOL));
const abi=AbiCoder.defaultAbiCoder();
export const stageMatches={quarter:['qf-01','qf-02','qf-03','qf-04'],semi:['sf-01','sf-02'],final:['gf-01']};
const fold=(a,b)=>keccak256(concat(BigInt(a)<BigInt(b)?[a,b]:[b,a]));

export function validateMatchSnapshot(s){
  requireThat(s?.protocol===MATCH_PROTOCOL&&s.campaignId==='worlds-2026'&&stageMatches[s.stage]?.includes(s.matchId),'Invalid match snapshot identity.');
  requireThat(same(s.matchKey,matchKeyFor(s.matchId))&&/^[a-f0-9]{64}$/i.test(s.identityHash)&&hash32(s.publicKey),'Invalid snapshot key or result identity.');
  requireThat(['finished','cancelled'].includes(s.status)&&canonical(s.policy)===canonical(POLICY),'Snapshot must contain a final result and winner-only policy.');
  requireThat(typeof s.sourceUrl==='string'&&Number.isFinite(Date.parse(s.frozenAt)),'Snapshot provenance is missing.');
  const l=s.ledger;
  requireThat(l?.version===1&&l.campaignId===s.campaignId&&l.matchId===s.matchId&&l.winner===s.winner&&l.prizeSlotCount===1&&l.alternateCount===0,'Snapshot ledger identity or prize count differs.');
  requireThat(Number.isSafeInteger(l.totalTickets)&&l.totalTickets>=0&&l.totalTickets<=1_000_000&&Array.isArray(l.entries),'Invalid snapshot ticket count.');
  let cursor=1;const votes=new Set();
  for(const e of l.entries){
    requireThat(typeof e.voteId==='string'&&e.voteId.length>0&&!votes.has(e.voteId)&&/^[a-f0-9]{64}$/i.test(e.participantId)&&e.start===cursor&&Number.isSafeInteger(e.end)&&e.end>=cursor,'Invalid snapshot ticket range.');
    votes.add(e.voteId);cursor=e.end+1;
  }
  // Canonical HTTP export sorts object keys. Reconstruct the original ledger's
  // explicitly ordered v1 encoding, just as the round verifier does.
  const original={version:1,campaignId:s.campaignId,matchId:s.matchId,winner:s.winner,prizeSlotCount:1,alternateCount:0,totalTickets:l.totalTickets,entries:l.entries.map(e=>({voteId:e.voteId,participantId:e.participantId,start:e.start,end:e.end}))};
  requireThat(cursor===l.totalTickets+1&&canonical(original)===canonical(l)&&same(keccak256(toUtf8Bytes(JSON.stringify(original))),s.ledgerHash),'Snapshot ledger bytes or total changed.');
  requireThat(s.status==='cancelled'?l.totalTickets===0&&s.winner===null:typeof s.winner==='string'&&s.winner.length>0,'Invalid final outcome.');
  requireThat(s.prize?.primary===1&&s.prize?.alternates===0&&s.prize?.units===1&&typeof s.prize.productId==='string','Snapshot prize plan is missing.');
  return s;
}

// Independent match-local numbering: later matches cannot shift earlier leaves.
export function buildMatchTree(snapshot){
  const s=validateMatchSnapshot(snapshot),count=s.ledger.totalTickets;
  if(count===0)return {root:keccak256(abi.encode(['bytes32','bytes32','uint256'],[MATCH_PROTOCOL_HASH,s.matchKey,0])),proof(){throw new Error('An empty roster has no ticket inclusion.');}};
  const nodes=new Array(count*2-1),encoded=new Uint8Array(128),view=new DataView(encoded.buffer);
  encoded.set(getBytes(MATCH_PROTOCOL_HASH));encoded.set(getBytes(s.matchKey),32);
  for(const e of s.ledger.entries){encoded.set(getBytes('0x'+e.participantId),96);for(let n=e.start;n<=e.end;n++){
    view.setUint32(92,n,false);nodes[nodes.length-n]=keccak_256(encoded);
  }}
  for(let i=count-2;i>=0;i--){const a=nodes[2*i+1],b=nodes[2*i+2];let order=0;for(let j=0;j<32&&order===0;j++)order=a[j]-b[j];const bytes=new Uint8Array(64);bytes.set(order<0?a:b);bytes.set(order<0?b:a,32);nodes[i]=keccak_256(bytes);}
  return {root:hexlify(nodes[0]),proof(ticketNumber){
    requireThat(Number.isSafeInteger(ticketNumber)&&ticketNumber>=1&&ticketNumber<=count,'Ticket is absent from match.');
    let i=nodes.length-ticketNumber;const path=[];while(i>0){path.push(hexlify(nodes[i%2===0?i-1:i+1]));i=Math.floor((i-1)/2);}return path;
  }};
}
export function matchCommitmentFor(snapshot){
  return {matchKey:snapshot.matchKey,root:buildMatchTree(snapshot).root,snapshotHash:digest(snapshot),publicKey:snapshot.publicKey,ticketCount:snapshot.ledger.totalTickets};
}
export function verifyMatchInclusion(snapshot,ticketNumber,participantId,path){
  const leaf=keccak256(abi.encode(['bytes32','bytes32','uint256','bytes32'],[MATCH_PROTOCOL_HASH,snapshot.matchKey,ticketNumber,'0x'+participantId]));
  return Array.isArray(path)&&path.length<=32&&path.every(hash32)&&same(path.reduce(fold,leaf),buildMatchTree(snapshot).root);
}
export function validateRoundSnapshots(manifest){
  requireThat(manifest.registryVersion===3&&Array.isArray(manifest.matchSnapshots),'Round must bind the early match snapshots.');
  requireThat(canonical(manifest.matchSnapshots.map(a=>a.snapshot?.matchId))===canonical(stageMatches[manifest.stage]),'Early snapshot set is incomplete or reordered.');
  const source=JSON.parse(manifest.sourceRoundJson);
  for(const anchor of manifest.matchSnapshots){
    const s=validateMatchSnapshot(anchor.snapshot),c=matchCommitmentFor(s);
    requireThat(s.stage===manifest.stage,'Snapshot belongs to another stage.');
    for(const [k,v] of Object.entries(c))requireThat(typeof v==='number'?anchor.commitment?.[k]===v:same(anchor.commitment?.[k],v),'Early snapshot commitment differs.');
    requireThat(hash32(anchor.chain?.commitmentTx)&&Number.isSafeInteger(anchor.chain.commitmentBlockNumber)&&anchor.chain.commitmentBlockNumber>0,'Early chain evidence is missing.');
    const m=manifest.matches.find(m=>m.matchId===s.matchId),excluded=manifest.excluded.find(m=>m.matchId===s.matchId);
    if(m){
      requireThat(s.status==='finished'&&s.ledger.totalTickets>0&&s.winner===m.winner&&same(s.identityHash,m.identityHash)&&same(s.ledgerHash,m.ledgerHash)&&canonical(s.ledger.entries)===canonical(m.entries)&&canonical(s.prize)===canonical(m.prize),'Draw roster or prize differs from the earlier match snapshot.');
      const original=source.matches.find(m=>m.matchId===s.matchId);
      requireThat(canonical(original?.manifest.publicLedger)===canonical(s.ledger),'Frozen source differs from the earlier snapshot.');
    }else requireThat(excluded&&same(excluded.identityHash,s.identityHash)&&excluded.winner===s.winner&&excluded.reason===(s.status==='cancelled'?'cancelled':'no-eligible-tickets')&&s.ledger.totalTickets===0,'Empty or cancelled snapshot exclusion differs.');
  }
}
