// Synthetic data is isolated to this suite; it is never imported by the app.
import test from 'node:test';
import assert from 'node:assert/strict';
import { canonical, digest } from '../../shared/public-proof/worlds/protocol.mjs';
import { RUNTIME_HASH } from '../../shared/public-proof/worlds/chain.mjs';
import { createWorldsVerification } from '../../shared/public-proof/worlds/steps.mjs';
import { worldsProofConfig } from '../../server/public-proof/config.mjs';
import { createPublicProofRoutes } from '../../server/public-proof/routes.mjs';
import { fixture, testBundle } from './fixtures.mjs';

const h=n=>'0x'+String(n).repeat(64);
const chain={chainId:56,contract:'0x1111111111111111111111111111111111111111',runtimeHash:RUNTIME_HASH,
  commitmentTx:h(1),requestTx:h(2),commitmentBlockNumber:3,commitmentBlockHash:h(3),requestBlockNumber:4,requestBlockHash:h(4)};
const authority={configured:true,chainId:56,contract:chain.contract,runtimeHash:RUNTIME_HASH,publicRpc:'https://bsc-dataseed.bnbchain.org'};
function setup(bundle=testBundle(fixture(),chain),registry=authority,readChain=async()=>chain){return createWorldsVerification({bundle,authority:registry,readChain,expectedBundleHash:digest(bundle)});}
test('six UI steps execute the real core in order, preserving winner and reserve ranks',async()=>{
 const verifier=setup();for(let n=1;n<=6;n++){const r=await verifier.run(n);assert.equal(r.step,n);assert.ok(r.chips.length);if(n===6)assert.deepEqual(r.picks.map(p=>p.rank),[0,1,2]);}
});
test('later steps cannot run before chain evidence is checked',async()=>{await assert.rejects(setup().run(3),/in order/);});
test('missing approved authority never falls back to bundle identity',async()=>{await assert.rejects(setup(undefined,{configured:false}).run(1),/尚未/);});
test('RPC failure prevents all subsequent verification, rather than approving API facts',async()=>{
 const v=setup(undefined,authority,async()=>{throw Error('RPC unreachable');});await assert.rejects(v.run(1),/RPC/);await assert.rejects(v.run(2),/in order/);
});
test('independent chain facts must agree with published facts',async()=>{await assert.rejects(setup(undefined,authority,async()=>({...chain,requestBlockHash:h(9)})).run(1),/Chain evidence differs/);});
test('tampered reserve order fails before any winner is displayed',async()=>{
 const b=testBundle(fixture(),chain);b.result.picks.reverse();const v=setup(b);for(let n=1;n<=3;n++)await v.run(n);await assert.rejects(v.run(4),/order/);await assert.rejects(v.run(5),/in order/);
});
test('source and authority are separate, and no default origin exists',()=>{
 const c=worldsProofConfig({MERCH_WORLDS_PROOF_ORIGIN:'https://example.com'});assert.equal(c.origin,'https://example.com');assert.equal(c.authority.configured,false);assert.equal(worldsProofConfig({}).origin,null);
});
test('nonlocal insecure origins, credentials and hidden paths are rejected',()=>{
 for(const origin of ['http://example.com','https://user:pass@example.com','https://example.com/private','https://example.com/?secret=1'])assert.throws(()=>worldsProofConfig({MERCH_WORLDS_PROOF_ORIGIN:origin}));
});
test('loopback data source requires explicit local-only authorization',()=>{
 assert.throws(()=>worldsProofConfig({MERCH_WORLDS_PROOF_ORIGIN:'http://127.0.0.1:3197'}));
 assert.equal(worldsProofConfig({MERCH_WORLDS_PROOF_ORIGIN:'http://127.0.0.1:3197',MERCH_PROOF_ALLOW_LOCAL_SOURCE:'true'}).origin,'http://127.0.0.1:3197');
 assert.throws(()=>worldsProofConfig({MERCH_WORLDS_PROOF_ORIGIN:'http://127.0.0.1:3197',MERCH_PROOF_ALLOW_LOCAL_SOURCE:'true',VERCEL:'1'}));
});
const environment={MERCH_WORLDS_PROOF_ORIGIN:'https://example.com'};
function responseCapture(){return {headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},writeHead(status,headers={}){this.status=status;for(const[k,v]of Object.entries(headers))this.setHeader(k,v);},end(body){this.body=body;}};}
test('public relay ignores source authority and never forwards user credentials or arbitrary URLs',async()=>{
 let request;const rounds=['quarter','semi','final'].map(stage=>({stage,name:stage,status:'awaiting_results',roundId:h(1),bundleHash:null,proofUrl:null}));
 const route=createPublicProofRoutes({environment,fetchPublic:async(url,opts)=>{request={url,opts};return Response.json({registry:{...authority,contract:'0x2222222222222222222222222222222222222222'},rounds});}});
 const res=responseCapture();await route({method:'GET',headers:{cookie:'test-private-cookie',authorization:'test-private-token'}},res,new URL('https://merch.test/api/public-proofs/worlds-2026/rounds'));
 const body=JSON.parse(res.body);assert.equal(body.authority.configured,false);assert.equal(body.authority.contract,null);assert.deepEqual(request.opts.headers,{Accept:'application/json'});assert.equal(request.opts.redirect,'error');assert.equal(request.url,'https://example.com/api/ecvrf/rounds');assert.equal(res.headers['cache-control'],'no-store');
 await assert.rejects(route({method:'GET'},responseCapture(),new URL('https://merch.test/api/public-proofs/worlds-2026/rounds?url=https://attacker.test')),e=>e.code==='proof_query_invalid');
});
test('bundle download preserves canonical bytes, hash and attachment filename',async()=>{
 const b=testBundle(fixture(),chain),text=canonical(b),hash=digest(b);
 const route=createPublicProofRoutes({environment,fetchPublic:async()=>new Response(text,{headers:{'content-type':'application/json','x-proof-sha256':hash}})});
 const res=responseCapture();await route({method:'GET'},res,new URL('https://merch.test/api/public-proofs/worlds-2026/final/bundle?download=1'));
 assert.equal(res.body.toString(),text);assert.equal(res.headers['x-proof-sha256'],hash);assert.match(res.headers['content-disposition'],/worlds-ecvrf-final.json/);
});
test('bundle for another stage or mismatching raw bytes is rejected',async()=>{
 const b=testBundle(fixture(),chain);
 for(const [stage,hash]of [['semi',digest(b)],['final',h(9)]]){
 const route=createPublicProofRoutes({environment,fetchPublic:async()=>new Response(canonical(b),{headers:{'content-type':'application/json','x-proof-sha256':hash}})});
 await assert.rejects(route({method:'GET'},responseCapture(),new URL(`https://merch.test/api/public-proofs/worlds-2026/${stage}/bundle`)),e=>e.code==='proof_bundle_invalid');}
});
test('unconfigured source and unknown events fail visibly',async()=>{
 const route=createPublicProofRoutes({environment:{}});
 await assert.rejects(route({method:'GET'},responseCapture(),new URL('https://merch.test/api/public-proofs/worlds-2026/rounds')),e=>e.code==='proof_source_not_configured');
 await assert.rejects(route({method:'GET'},responseCapture(),new URL('https://merch.test/api/public-proofs/surf/rounds')),e=>e.code==='proof_event_not_supported');
});
test('a pinned download rejects a different published record',async()=>{
 const b=testBundle(fixture(),chain);const route=createPublicProofRoutes({environment,fetchPublic:async()=>new Response(canonical(b),{headers:{'content-type':'application/json','x-proof-sha256':digest(b)}})});
 await assert.rejects(route({method:'GET'},responseCapture(),new URL(`https://merch.test/api/public-proofs/worlds-2026/final/bundle?download=1&bundleHash=${h(9)}`)),e=>e.code==='proof_record_changed');
});
test('invalid JSON roots, HTML and oversized payloads fail without copying source errors',async()=>{
 for(const response of [Response.json(null),Response.json({rounds:[null,{},{}]}),new Response('<html>error</html>',{headers:{'content-type':'text/html'}}),new Response('{}',{headers:{'content-type':'application/json','content-length':String(33*1024*1024)}})]){
  const route=createPublicProofRoutes({environment,fetchPublic:async()=>response});
  await assert.rejects(route({method:'GET'},responseCapture(),new URL('https://merch.test/api/public-proofs/worlds-2026/rounds')),e=>e.status===502);
 }
});
