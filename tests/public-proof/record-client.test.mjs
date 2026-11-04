// Isolated client contract tests. No synthetic proof is served by the product.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fixture, testBundle } from './fixtures.mjs';
import { canonical, digest } from '../../shared/public-proof/worlds/protocol.mjs';
import { RUNTIME_HASH } from '../../shared/public-proof/worlds/chain.mjs';

test('transaction client dispatches only reviewed formats and binds both commit and request identities',async()=>{
 const vite=await createServer({configFile:false,mode:'local-preview',server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 const originalFetch=globalThis.fetch;
 try{
  const client=await vite.ssrLoadModule('/src/components/PublicVerification/recordClient.ts');
  const h=n=>'0x'+String(n).repeat(64),chain={chainId:56,contract:'0x1111111111111111111111111111111111111111',runtimeHash:RUNTIME_HASH,commitmentTx:h(1),requestTx:h(2),commitmentBlockNumber:3,commitmentBlockHash:h(3),requestBlockNumber:4,requestBlockHash:h(4)};
  const bundle=testBundle(fixture(),chain),bundleHash=digest(bundle),authority={configured:true,chainId:56,contract:chain.contract,runtimeHash:RUNTIME_HASH,publicRpc:'https://bsc-dataseed.bnbchain.org'};
  const result={event:client.worldsEvent,record:{kind:'draw',stage:'final',tx:chain.requestTx,transaction:chain.commitmentTx,bundleHash,roundId:bundle.commitment.roundId}};
  let response=result;
  const requests=[];
  globalThis.fetch=async(url,options)=>{requests.push({url,options});return Response.json(response);};
  const selector={tx:chain.commitmentTx,bundleHash:'',stage:undefined,event:null};
  const found=await client.resolveProofRecord(selector,new AbortController().signal);
  assert.equal(found.record.tx,chain.requestTx);
  assert.equal(requests[0].url,'/api/public-proofs/resolve?tx='+chain.commitmentTx);
  assert.equal(requests[0].options.cache,'no-store');
  response={...result,event:{id:'another-event',name:'Another event',verifier:'different-protocol-v1'}};
  await assert.rejects(client.resolveProofRecord(selector,new AbortController().signal),e=>e.code==='proof_verifier_not_supported');
  response={...result,record:{...result.record,transaction:h(8)}};
  await assert.rejects(client.resolveProofRecord(selector,new AbortController().signal),e=>e.code==='proof_record_changed');
  response=result;
  await assert.rejects(client.resolveProofRecord({...selector,event:'another-event'},new AbortController().signal),e=>e.code==='proof_record_changed');
  globalThis.fetch=async url=>String(url).endsWith('/rounds')?Response.json({event:'worlds-2026',authority,authorities:[authority],rounds:['quarter','semi','final'].map(stage=>({stage,status:stage==='final'?'published':'awaiting_results',bundleHash:stage==='final'?bundleHash:null,roundId:bundle.commitment.roundId}))}):new Response(canonical(bundle),{headers:{'x-proof-sha256':bundleHash}});
  const loaded=await client.loadResolvedRecord(result,new AbortController().signal);
  assert.equal(loaded.proof.bundleHash,bundleHash);
  await assert.rejects(client.loadResolvedRecord({...result,record:{...result.record,transaction:h(9)}},new AbortController().signal),e=>e.code==='proof_record_changed');
  await assert.rejects(client.loadResolvedRecord({...result,record:{...result.record,roundId:h(9)}},new AbortController().signal),e=>e.code==='proof_record_changed');
 }finally{globalThis.fetch=originalFetch;await vite.close();}
});
