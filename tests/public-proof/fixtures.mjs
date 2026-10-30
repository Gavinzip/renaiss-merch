// Synthetic fixtures are limited to automated tests and the explicitly authorized
// loopback visual preview. The production application never imports this module.
import {keccak256,toUtf8Bytes,hexlify,getBytes} from 'ethers';
import {PROTOCOL,POLICY,roundIdFor,matchKeyFor,commitmentFor,digest,deriveAlpha,verifiedBeta,selectTickets} from '../../shared/public-proof/worlds/protocol.mjs';
import {prove} from '../../shared/public-proof/worlds/vendor/prove.ts';
import {secretScalarAndPublicKey} from '../../shared/public-proof/worlds/vendor/rfc8032-keys.ts';
// Public RFC 9381 example key, never a production key.
export const RFC_KEY='0x9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
export const publicKey=hexlify(secretScalarAndPublicKey(getBytes(RFC_KEY)).Y.toBytes());
const h=text=>keccak256(toUtf8Bytes(text));
export function fixture(stage='final',counts=[7]){
  const ids=stage==='quarter'?['qf-01','qf-02','qf-03','qf-04']:stage==='semi'?['sf-01','sf-02']:['gf-01'];
  const sourceRound={version:1,campaignId:'worlds-2026',stage,roundId:roundIdFor(stage),matches:[],excluded:[]};
  const matches=ids.map((id,i)=>{
    const total=counts[i]??7;
    const entries=[{voteId:`test-vote:${id}:1`,participantId:'a'.repeat(64),start:1,end:3},{voteId:`test-vote:${id}:2`,participantId:'a'.repeat(64),start:4,end:total}];
    const ledger={version:1,campaignId:'worlds-2026',matchId:id,winner:'test-team',prizeSlotCount:1,alternateCount:2,totalTickets:total,entries};
    const ledgerHash=h(JSON.stringify(ledger)),identityHash=h(`test-identity:${id}`).slice(2),matchKey=matchKeyFor(id);
    sourceRound.matches.push({matchId:id,identityHash,status:'finished',winner:'test-team',manifest:{publicLedger:ledger,ledgerHash,roundId:sourceRound.roundId,matchKey}});
    return {matchId:id,matchKey,identityHash,ledgerHash,winner:'test-team',totalTickets:total,entries,prize:{id:stage,productId:`test-product:${stage}`,name:'Automated test prize',units:1,primary:1,alternates:2}};
  });
  const sourceRoundJson=JSON.stringify(sourceRound);
  return {protocol:PROTOCOL,campaignId:'worlds-2026',stage,roundId:roundIdFor(stage),sourceRoundJson,roundLedgerHash:h(sourceRoundJson),policy:POLICY,matches,excluded:[]};
}
export function testBundle(manifest,chain){
  const commitment={...commitmentFor(manifest),publicKey},alpha=deriveAlpha(commitment,chain),proof=hexlify(prove(getBytes(RFC_KEY),getBytes(alpha)).piString),beta=verifiedBeta(publicKey,alpha,proof),result=selectTickets(manifest,beta);
  const bundle={protocol:PROTOCOL,manifest,commitment,chain,alpha,proof,beta,result,resultHash:digest(result),publishedAt:'2026-10-26T00:00:00.000Z'};return bundle;
}
