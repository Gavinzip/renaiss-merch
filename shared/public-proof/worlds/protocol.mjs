/*! @license ECVRF core Copyright (c) 2026 Renaiss, MIT. Full notice: /licenses/renaiss-ecvrf-MIT.txt */
import {AbiCoder,concat,getBytes,hexlify,keccak256,sha256,toUtf8Bytes} from 'ethers';
import {sha512} from '@noble/hashes/sha2.js';
import {keccak_256} from '@noble/hashes/sha3.js';
import {verify} from './vendor/verify.ts';
import {registryRoundId} from './round-identity.mjs';

export const PROTOCOL='renaiss-worlds-ticket-ecvrf-v1';
export const PROTOCOL_HASH=keccak256(toUtf8Bytes(PROTOCOL));
export const CAMPAIGN='worlds-2026';
export const POLICY=Object.freeze({primary:1,alternates:2,uniqueTicketsPerMatch:true,excludeOtherTicketsOfSamePerson:false});
const abi=AbiCoder.defaultAbiCoder();
export const hash32=(value)=>typeof value==='string'&&/^0x[0-9a-f]{64}$/i.test(value);
export const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
export function requireThat(test,message){if(!test){const error=new Error(message);error.name='EcvRfVerificationError';throw error;}}
export function canonical(value){
  if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number'){requireThat(Number.isSafeInteger(value),'Manifest numbers must be safe integers.');return String(value);}
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  requireThat(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype,'Unsupported canonical value.');
  return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
export const digest=value=>sha256(toUtf8Bytes(canonical(value)));
export const roundIdFor=stage=>keccak256(toUtf8Bytes(`${CAMPAIGN}:${stage}`));
export const matchKeyFor=id=>keccak256(toUtf8Bytes(`${CAMPAIGN}:${id}`));
const expected={quarter:['qf-01','qf-02','qf-03','qf-04'],semi:['sf-01','sf-02'],final:['gf-01']};

export function validateManifest(m){
  let drawRoundId=roundIdFor(m?.stage);
  if(m?.roundIdentity!==undefined){
    requireThat(m.roundIdentity?.eventId===m.campaignId&&m.roundIdentity?.stage===m.stage,'Event round identity differs from the manifest.');
    drawRoundId=registryRoundId(m.roundIdentity);
  }
  requireThat(m?.protocol===PROTOCOL&&m.campaignId===CAMPAIGN&&expected[m.stage]&&same(m.roundId,drawRoundId),'Wrong protocol, campaign or round.');
  requireThat(canonical(m.policy)===canonical(POLICY),'Ticket or reserve policy differs.');
  requireThat(hash32(m.roundLedgerHash)&&Array.isArray(m.matches)&&Array.isArray(m.excluded),'Incomplete round manifest.');
  requireThat(typeof m.sourceRoundJson==='string','Original round bytes are missing.');
  const sourceRound=JSON.parse(m.sourceRoundJson);
  requireThat(sourceRound?.version===1&&sourceRound.campaignId===CAMPAIGN&&sourceRound.stage===m.stage&&same(sourceRound.roundId,roundIdFor(m.stage))&&same(keccak256(toUtf8Bytes(m.sourceRoundJson)),m.roundLedgerHash),'Source round hash is invalid.');
  requireThat(sourceRound.matches.length===m.matches.length&&canonical(sourceRound.excluded)===canonical(m.excluded),'Source round membership differs.');
  const ids=[...m.matches,...m.excluded].map(x=>x.matchId).sort();
  requireThat(canonical(ids)===canonical(expected[m.stage]),'Round match set is incomplete or duplicated.');
  requireThat(m.matches.length>0,'No eligible matches.');
  let previous='';
  for(const match of m.matches){
    requireThat(match.matchId>previous&&same(match.matchKey,matchKeyFor(match.matchId))&&hash32(match.ledgerHash)&&/^[a-f0-9]{64}$/i.test(match.identityHash),'Invalid match ordering or identity.');previous=match.matchId;
    requireThat(Number.isSafeInteger(match.totalTickets)&&match.totalTickets>=3&&match.totalTickets<=1_000_000,'Each match requires 3–1,000,000 eligible tickets.');
    requireThat(match.prize?.units===1&&match.prize?.primary===1&&match.prize?.alternates===2&&typeof match.prize?.productId==='string','Invalid prize plan.');
    requireThat(Array.isArray(match.entries)&&match.entries.length>0,'Empty ticket mapping.');
    const votes=new Set();let cursor=1;
    for(const entry of match.entries){
      requireThat(typeof entry.voteId==='string'&&entry.voteId.length>0&&!votes.has(entry.voteId)&&/^[a-f0-9]{64}$/i.test(entry.participantId)&&entry.start===cursor&&Number.isSafeInteger(entry.end)&&entry.end>=cursor,'Invalid, overlapping or duplicate ticket range.');
      votes.add(entry.voteId);cursor=entry.end+1;
    }
    requireThat(cursor===match.totalTickets+1,'Ticket ranges and total disagree.');
    // This is the exact existing v1 ledger encoding, retained as a source binding.
    const ledger={version:1,campaignId:CAMPAIGN,matchId:match.matchId,winner:match.winner,prizeSlotCount:1,alternateCount:2,totalTickets:match.totalTickets,entries:match.entries.map(e=>({voteId:e.voteId,participantId:e.participantId,start:e.start,end:e.end}))};
    requireThat(same(keccak256(toUtf8Bytes(JSON.stringify(ledger))),match.ledgerHash),'Ticket mapping differs from the locked source ledger.');
    const source=sourceRound.matches.find(x=>x.matchId===match.matchId);
    requireThat(source&&source.status==='finished'&&same(source.identityHash,match.identityHash)&&source.winner===match.winner&&same(source.manifest.matchKey,match.matchKey)&&same(source.manifest.roundId,sourceRound.roundId)&&same(source.manifest.ledgerHash,match.ledgerHash)&&JSON.stringify(source.manifest.publicLedger)===JSON.stringify(ledger),'Manifest no longer matches the original frozen round.');
  }
  requireThat(m.matches.reduce((n,x)=>n+x.totalTickets,0)<=1_000_000,'Round ticket count exceeds v1 capacity.');
  for(const entry of m.excluded)requireThat(expected[m.stage].includes(entry.matchId)&&['cancelled','no-eligible-tickets'].includes(entry.reason),'Invalid excluded match.');
  return m;
}
export function ticketLeaf(ticket,roundId){
  return keccak256(abi.encode(['bytes32','bytes32','bytes32','uint256','uint256','bytes32'],[PROTOCOL_HASH,roundId,matchKeyFor(ticket.matchId),ticket.position,ticket.ticketNumber,`0x${ticket.participantId}`]));
}
const pair=(a,b)=>keccak256(concat(BigInt(a)<BigInt(b)?[a,b]:[b,a]));
function parentBytes(a,b){
  let order=0;for(let i=0;i<32&&order===0;i++)order=a[i]-b[i];
  const bytes=new Uint8Array(64);bytes.set(order<0?a:b);bytes.set(order<0?b:a,32);return keccak_256(bytes);
}
export function sampleBelow(bound,nextWord){
  requireThat(Number.isSafeInteger(bound)&&bound>0,'Invalid random bound.');
  const m=BigInt(bound),space=1n<<512n,limit=space-space%m;
  for(;;){const word=nextWord();requireThat(typeof word==='bigint'&&word>=0n&&word<space,'Random word must be uint512.');if(word<limit)return Number(word%m);}
}
export function buildTicketTree(manifest){
  validateManifest(manifest);
  const tickets=[],offsets=new Map(),leaves=[];
  // Same six static ABI words as ticketLeaf. Reuse one 192-byte encoding
  // buffer instead of allocating an AbiCoder graph for every ticket.
  // v1's <=1,000,000 limits fit the low uint32 of a zero-padded uint256 word.
  const encoded=new Uint8Array(192),view=new DataView(encoded.buffer);
  encoded.set(getBytes(PROTOCOL_HASH));encoded.set(getBytes(manifest.roundId),32);
  for(const match of manifest.matches){
    offsets.set(match.matchId,tickets.length);
    encoded.set(getBytes(match.matchKey),64);
    for(const e of match.entries){encoded.set(getBytes(`0x${e.participantId}`),160);for(let n=e.start;n<=e.end;n++){
      const position=tickets.length+1;tickets.push({position,matchId:match.matchId,ticketNumber:n,participantId:e.participantId});
      view.setUint32(124,position,false);view.setUint32(156,n,false);leaves.push(keccak_256(encoded));
    }}
  }
  const nodes=new Array(2*tickets.length-1);
  leaves.forEach((leaf,i)=>{nodes[nodes.length-1-i]=leaf;});
  for(let i=tickets.length-2;i>=0;i--)nodes[i]=parentBytes(nodes[2*i+1],nodes[2*i+2]);
  return {root:hexlify(nodes[0]),tickets,offsets,proof(position){
    requireThat(Number.isSafeInteger(position)&&position>0&&position<=tickets.length,'Ticket absent from tree.');
    let i=nodes.length-position;const path=[];
    while(i>0){path.push(hexlify(nodes[i%2===0?i-1:i+1]));i=Math.floor((i-1)/2);}return path;
  }};
}
export function verifyInclusion(ticket,path,root,roundId){
  return Array.isArray(path)&&path.length<=32&&path.every(hash32)&&same(path.reduce(pair,ticketLeaf(ticket,roundId)),root);
}
export function commitmentFor(manifest,tree=buildTicketTree(manifest)){
  return {roundId:manifest.roundId,root:tree.root,manifestHash:digest(manifest),prizePlanHash:digest(manifest.matches.map(m=>({matchId:m.matchId,...m.prize}))),ticketCount:tree.tickets.length,protocolHash:PROTOCOL_HASH};
}
export function deriveAlpha(commitment,facts){
  const c=commitment;
  requireThat(hash32(facts.requestBlockHash)&&Number.isSafeInteger(facts.requestBlockNumber),'Missing finalized request block.');
  return keccak256(abi.encode(['bytes32','uint256','address','bytes32','bytes32','bytes32','bytes32','uint256','bytes32','bytes32','uint256'],[PROTOCOL_HASH,facts.chainId,facts.contract,c.roundId,c.root,c.manifestHash,c.prizePlanHash,c.ticketCount,c.publicKey,facts.requestBlockHash,facts.requestBlockNumber]));
}
export function verifiedBeta(publicKey,alpha,proofHex){
  requireThat(hash32(publicKey)&&hash32(alpha)&&/^0x[0-9a-f]{160}$/i.test(proofHex),'Invalid ECVRF key, input or proof length.');
  const beta=verify(getBytes(publicKey),getBytes(alpha),getBytes(proofHex));
  requireThat(beta!==null,'ECVRF proof is invalid.');return hexlify(beta);
}
// One stream per round, matches in committed order, forward partial Fisher–Yates.
// Counter advances on every 512-bit word, including rejected words.
export function selectTickets(manifest,betaHex,tree=buildTicketTree(manifest)){
  requireThat(/^0x[0-9a-f]{128}$/i.test(betaHex),'ECVRF beta must be 64 bytes.');
  let counter=0n;const picks=[],beta=getBytes(betaHex);
  const below=bound=>sampleBelow(bound,()=>{const bytes=getBytes(`0x${(counter++).toString(16).padStart(64,'0')}`);return BigInt(hexlify(sha512(getBytes(concat([beta,bytes])))));});
  for(const match of manifest.matches){
    const swaps=new Map(),offset=tree.offsets.get(match.matchId);
    for(let rank=0;rank<3;rank++){
      const j=rank+below(match.totalTickets-rank),at=swaps.get(j)??j;
      swaps.set(j,swaps.get(rank)??rank);swaps.set(rank,at);
      const ticket=tree.tickets[offset+at];
      picks.push({...ticket,rank,positionType:rank===0?'winner':'alternate',path:tree.proof(ticket.position)});
    }
  }
  return {picks,wordsConsumed:counter.toString()};
}
export function verifyBundle(bundle,expectedBundleHash,cachedTree){
  requireThat(bundle?.protocol===PROTOCOL,'Unsupported proof bundle.');
  const bundleHash=digest(bundle);
  if(expectedBundleHash!==undefined)requireThat(same(bundleHash,expectedBundleHash),'Proof bundle hash mismatch.');
  const tree=cachedTree??buildTicketTree(bundle.manifest),computed=commitmentFor(bundle.manifest,tree),c=bundle.commitment;
  for(const key of Object.keys(computed))requireThat(typeof computed[key]==='string'?same(computed[key],c?.[key]):computed[key]===c?.[key],`Commitment mismatch: ${key}`);
  const alpha=deriveAlpha(c,bundle.chain),beta=verifiedBeta(c.publicKey,alpha,bundle.proof);
  requireThat(same(alpha,bundle.alpha)&&same(beta,bundle.beta),'Published alpha or beta differs from recomputation.');
  const result=selectTickets(bundle.manifest,beta,tree);
  requireThat(canonical(result)===canonical(bundle.result),'Winner order, reserve order or Merkle paths differ.');
  for(const pick of result.picks)requireThat(verifyInclusion(pick,pick.path,c.root,c.roundId),'Invalid ticket inclusion.');
  requireThat(same(digest(result),bundle.resultHash),'Result hash mismatch.');
  return {manifestHash:computed.manifestHash,root:tree.root,alpha,beta,resultHash:bundle.resultHash,bundleHash,picks:result.picks};
}
