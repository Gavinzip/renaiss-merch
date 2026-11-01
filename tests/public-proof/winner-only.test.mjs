import test from 'node:test';
import assert from 'node:assert/strict';
import {POLICY,LEGACY_POLICY,buildTicketTree,commitmentFor,verifyBundle,deriveAlpha,selectTickets,digest} from '../../shared/public-proof/worlds/protocol.mjs';
import {fixture,testBundle,publicKey} from './fixtures.mjs';
const facts={chainId:56,contract:'0x1111111111111111111111111111111111111111',requestBlockNumber:123,requestBlockHash:`0x${'2'.repeat(64)}`};

test('new policy produces exactly one winner for every match, including one or two eligible tickets',()=>{
  for(const [stage,counts] of [['final',[3]],['semi',[1,2]],['quarter',[1,2,7,19]]]){
    const manifest=fixture(stage,counts,POLICY),bundle=testBundle(manifest,facts);
    const verified=verifyBundle(bundle,digest(bundle));
    assert.equal(verified.picks.length,counts.length);
    for(const match of manifest.matches){
      const picks=verified.picks.filter(p=>p.matchId===match.matchId);
      assert.equal(picks.length,1);assert.equal(picks[0].rank,0);assert.equal(picks[0].positionType,'winner');
      assert.ok(picks[0].ticketNumber>=1&&picks[0].ticketNumber<=match.totalTickets);
    }
  }
});
test('rounds below the approved contract minimum fail before any commitment transaction',()=>{
  for(const total of [1,2])assert.throws(()=>commitmentFor(fixture('final',[total],POLICY)),/contract limits/);
});
test('new policy counts are bound to manifest, prize plan and source ledger before entropy',()=>{
  const old=fixture('final',[7],LEGACY_POLICY),current=fixture('final',[7],POLICY);
  const a={...commitmentFor(old),publicKey},b={...commitmentFor(current),publicKey};
  assert.equal(a.root,b.root);assert.equal(a.protocolHash,b.protocolHash);
  assert.notEqual(a.manifestHash,b.manifestHash);assert.notEqual(a.prizePlanHash,b.prizePlanHash);
  assert.notEqual(deriveAlpha(a,facts),deriveAlpha(b,facts));
  const legacy=testBundle(old,facts);assert.equal(verifyBundle(legacy).picks.length,3);
  const altered=structuredClone(legacy);altered.manifest=current;
  assert.throws(()=>verifyBundle(altered),/Commitment mismatch/);
});
test('policy downgrade, extra alternate, mismatched prize count and uncommitted result all fail closed',()=>{
  for(const mutate of [m=>delete m.policy.version,m=>m.policy.alternates=2,m=>m.matches[0].prize.alternates=2]){
    const manifest=structuredClone(fixture('final',[7],POLICY));mutate(manifest);assert.throws(()=>buildTicketTree(manifest));
  }
  const bundle=testBundle(fixture('final',[7],POLICY),facts),extra=structuredClone(bundle);
  extra.result.picks.push({...extra.result.picks[0],rank:1,positionType:'alternate'});
  assert.throws(()=>verifyBundle(extra),/order|paths/);
  assert.equal(selectTickets(bundle.manifest,bundle.beta).picks.length,1);
});
