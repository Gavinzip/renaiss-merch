// Isolated SSR checks only. Synthetic bundles never reach the product server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fixture, testBundle } from './fixtures.mjs';
import { digest } from '../../shared/public-proof/worlds/protocol.mjs';
import { RUNTIME_HASH } from '../../shared/public-proof/worlds/chain.mjs';
import { createWorldsVerification } from '../../shared/public-proof/worlds/steps.mjs';
import { publicProofMedia } from '../../vite/publicProofMedia.ts';
import { canonical } from '../../shared/public-proof/worlds/protocol.mjs';

test('latest complete scene renderer handles real adapter states without KBW math or fake passes',async()=>{
 const vite=await createServer({configFile:false,mode:'local-preview',server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',
   esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom']},optimizeDeps:{noDiscovery:true,include:[]},plugins:[publicProofMedia('local-preview',{})]});
 try{
  const {FairProofSequence}=await vite.ssrLoadModule('/src/components/PublicVerification/fair/FairProofSequence.tsx');
  const h=n=>'0x'+String(n).repeat(64);
  const chain={chainId:56,contract:'0x1111111111111111111111111111111111111111',runtimeHash:RUNTIME_HASH,commitmentTx:h(1),requestTx:h(2),commitmentBlockNumber:3,commitmentBlockHash:h(3),requestBlockNumber:4,requestBlockHash:h(4)};
  const bundle=testBundle(fixture(),chain),authority={configured:true,chainId:56,contract:chain.contract,runtimeHash:RUNTIME_HASH,publicRpc:'https://bsc-dataseed.bnbchain.org'};
  const proof={bundle,bundleHash:digest(bundle),authority};
  const client=await vite.ssrLoadModule('/src/components/PublicVerification/proofClient.ts');
  assert.equal(client.proofLocation('?event=worlds-2026&stage=final').stage,'final');
  for(const query of ['?event=surf','?stage=bad','?url=https://attacker.test','?stage=final&stage=semi','?tx=bad'])assert.throws(()=>client.proofLocation(query));
  const originalFetch=globalThis.fetch;
  try{
   globalThis.fetch=async()=>new Response(canonical(bundle),{headers:{'content-type':'application/json','x-proof-sha256':proof.bundleHash}});
   const overview={event:'worlds-2026',authority,authorities:[authority],rounds:[{stage:'final',status:'published',bundleHash:proof.bundleHash,roundId:bundle.manifest.roundId}]};
   const loaded=await client.readRoundProof(overview,'final',proof.bundleHash,chain.requestTx,new AbortController().signal);
   assert.equal(loaded.bundleHash,proof.bundleHash);
   await assert.rejects(client.readRoundProof(overview,'final',h(9),chain.requestTx,new AbortController().signal),/雜湊/);
   await assert.rejects(client.readRoundProof(overview,'final',proof.bundleHash,h(9),new AbortController().signal),/交易/);
  }finally{globalThis.fetch=originalFetch;}
  const props={proof,checks:[],ready:false,running:null,error:null,run(){throw Error('SSR must not execute verification effects');},locale:'en'};
  const pending=renderToStaticMarkup(createElement(FairProofSequence,props));
  assert.equal((pending.match(/class="sp-chapter"/g)??[]).length,6);
  assert.ok(!pending.includes('CHECKED IN YOUR BROWSER'));
  assert.ok(!pending.includes('04 · REPLAYED IN YOUR BROWSER'));
  assert.ok(!pending.includes('All six checks completed'));
  assert.ok(!/KBW|keccak256\(β\) mod|after sellout|checkoutId/.test(pending));
  const verifier=createWorldsVerification({bundle,expectedBundleHash:proof.bundleHash,authority,readChain:async()=>chain});
  const checks=[];for(let i=1;i<=6;i++)checks.push(await verifier.run(i));
  const verified=renderToStaticMarkup(createElement(FairProofSequence,{...props,ready:true,checks}));
  assert.ok(verified.includes('All six checks completed in this browser'));
  assert.ok(verified.includes('SHA-512'));
  assert.ok(verified.includes('04 · REPLAYED IN YOUR BROWSER'));
  assert.ok(verified.includes('Winner'));
  assert.ok(verified.includes('reserve 1'));
  assert.ok(verified.includes('reserve 2'));
  assert.ok(!verified.includes('proof-ticket-picker'));
  assert.ok(!verified.includes('Inspect a published ticket'));
  const {ProofScene}=await vite.ssrLoadModule('/src/components/PublicVerification/fair/ProofScenes.tsx');
  for(const [index,code] of ['W','R1','R2'].entries()){
   const pick=bundle.result.picks[index],role=index===0?'Winner':`Reserve ${index}`;
   const scene=renderToStaticMarkup(createElement(ProofScene,{chapter:5,progress:1,data:{
    verification:{ticket:{...pick,role,prizeName:bundle.manifest.matches[0].prize.name}}
   }}));
   assert.ok(scene.includes(`<small>${role}</small>`));
   assert.ok(scene.includes(`<strong aria-label="${role}">${code}</strong>`));
   assert.ok(!scene.includes(`<strong>${role}</strong>`));
  }
  const stopped=renderToStaticMarkup(createElement(FairProofSequence,{...props,error:'RPC unavailable'}));
  assert.ok(stopped.includes('No browser-verified result is shown'));
  assert.ok(!stopped.includes('All six checks completed'));
 }finally{await vite.close();}
});
