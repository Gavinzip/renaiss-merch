import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {getBytes,hexlify} from 'ethers';
import {verify} from '../../shared/public-proof/worlds/vendor/verify.ts';
import {prove} from '../../shared/public-proof/worlds/vendor/prove.ts';
import {buildTicketTree,verifyInclusion,selectTickets,verifyBundle,canonical,digest,sampleBelow} from '../../shared/public-proof/worlds/protocol.mjs';
import {fixture,testBundle,RFC_KEY,publicKey} from './fixtures.mjs';

const facts={chainId:31337,contract:'0x1111111111111111111111111111111111111111',requestBlockNumber:123,requestBlockHash:`0x${'2'.repeat(64)}`};
test('RFC 9381 B.4 example 19: published proof and beta, not a self-generated expectation',()=>{
  const pi='7d9c633ffeee27349264cf5c667579fc583b4bda63ab71d001f89c10003ab46f14adf9a3cd8b8412d9038531e865c341cafa73589b023d14311c331a9ad15ff2fb37831e00f0acaa6d73bc9997b06501';
  const beta='9d574bf9b8302ec0fc1e21c3ec5368269527b87b462ce36dab2d14ccf80c53cccf6758f058c5b1c856b116388152bbe509ee3b9ecfe63d93c3b4346c1fbc6c54';
  assert.equal(hexlify(prove(getBytes(RFC_KEY),new Uint8Array()).piString),`0x${pi}`);
  assert.equal(hexlify(verify(getBytes(publicKey),new Uint8Array(),getBytes(`0x${pi}`))),`0x${beta}`);
  assert.equal(verify(getBytes(publicKey),new Uint8Array([1]),getBytes(`0x${pi}`)),null);
});
test('RFC 9381 B.4 example 20: nonempty input',()=>{
  const pk='0x3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c';
  const pi='0x47b327393ff2dd81336f8a2ef10339112401253b3c714eeda879f12c509072ef055b48372bb82efbdce8e10c8cb9a2f9d60e93908f93df1623ad78a86a028d6bc064dbfc75a6a57379ef855dc6733801';
  assert.equal(hexlify(verify(getBytes(pk),getBytes('0x72'),getBytes(pi))),'0x38561d6b77b71d30eb97a062168ae12b667ce5c28caccdf76bc88e093e4635987cd96814ce55b4689b3dd2947f80e59aac7b7675f8083865b46c89b2ce9cc735');
});
test('odd-size Merkle trees, every ticket, and original JSON bytes survive canonical export',()=>{
  const manifest=fixture(),tree=buildTicketTree(manifest);
  for(const t of tree.tickets)assert.equal(verifyInclusion(t,tree.proof(t.position),tree.root,manifest.roundId),true);
  const bundle=testBundle(manifest,facts),roundTrip=JSON.parse(canonical(bundle));
  assert.equal(verifyBundle(roundTrip).resultHash,bundle.resultHash);
  const t=tree.tickets[0];assert.equal(verifyInclusion({...t,ticketNumber:999},tree.proof(t.position),tree.root,manifest.roundId),false);
});
test('same owner retains different tickets; each match has exactly one primary and two ordered reserves',()=>{
  const manifest=fixture('quarter',[7,9,11,13]),bundle=testBundle(manifest,facts);verifyBundle(bundle);
  assert.equal(bundle.result.picks.length,12);
  for(const m of manifest.matches){const picks=bundle.result.picks.filter(p=>p.matchId===m.matchId);assert.deepEqual(picks.map(p=>p.rank),[0,1,2]);assert.equal(new Set(picks.map(p=>p.ticketNumber)).size,3);assert.equal(new Set(picks.map(p=>p.participantId)).size,1);}
});
test('sparse selection agrees with an independently implemented dense shuffle and Node SHA-512',()=>{
  const manifest=fixture('quarter',[101,53,17,39]),bundle=testBundle(manifest,facts);let counter=0n;const expected=[];
  for(const m of manifest.matches){const pool=Array.from({length:m.totalTickets},(_,i)=>i+1);for(let i=0;i<3;i++){
    const bound=BigInt(pool.length-i),space=2n**512n,limit=space-space%bound;let n;
    do{n=BigInt('0x'+createHash('sha512').update(getBytes(bundle.beta)).update(Buffer.from((counter++).toString(16).padStart(64,'0'),'hex')).digest('hex'));}while(n>=limit);
    const j=i+Number(n%bound);[pool[i],pool[j]]=[pool[j],pool[i]];expected.push([m.matchId,pool[i],i]);
  }}
  assert.deepEqual(bundle.result.picks.map(p=>[p.matchId,p.ticketNumber,p.rank]),expected);assert.equal(bundle.result.wordsConsumed,counter.toString());
});
test('tampering proof, key, seed, ownership, prize order, path, ticket, reserve rank or bundle hash fails closed',()=>{
  const original=testBundle(fixture('semi',[7,9]),facts);
  const changes=[b=>b.proof=`0x${'0'.repeat(160)}`,b=>b.commitment.publicKey=`0x${'1'.repeat(64)}`,b=>b.chain.requestBlockHash=`0x${'3'.repeat(64)}`,b=>b.manifest.matches[0].entries[0].participantId='b'.repeat(64),b=>b.manifest.matches.reverse(),b=>b.result.picks[0].path[0]=`0x${'0'.repeat(64)}`,b=>b.result.picks[0].ticketNumber++,b=>b.result.picks[1].rank=2];
  for(const change of changes){const b=structuredClone(original);change(b);assert.throws(()=>verifyBundle(b));}
  assert.throws(()=>verifyBundle(original,`0x${'0'.repeat(64)}`));
});
test('duplicate and overlapping ranges, missing match and unsupported policy are rejected',()=>{
  for(const mutate of [m=>m.matches[0].entries[1].start=3,m=>m.matches[0].entries[1].voteId=m.matches[0].entries[0].voteId,m=>m.matches.pop(),m=>m.policy={...m.policy,alternates:1}]){const m=fixture('semi',[7,9]);mutate(m);assert.throws(()=>buildTicketTree(m));}
});
test('rejection boundary consumes a rejected word before the accepted word; power-of-two bounds accept the maximum',()=>{
  let consumed=0;const values=[(1n<<512n)-1n,11n];assert.equal(sampleBelow(3,()=>values[consumed++]),2);assert.equal(consumed,2);
  assert.equal(sampleBelow(8,()=>(1n<<512n)-1n),7);assert.throws(()=>sampleBelow(0,()=>0n));
});
