// Synthetic source indices are confined to unit tests, never the preview server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface, keccak256, toUtf8Bytes } from 'ethers';
import { createProofRegistry, createProofLookupRoutes } from '../../server/public-proof/registry.mjs';
import { createWorldsProofAdapter, readApprovedTransaction } from '../../server/public-proof/worlds-adapter.mjs';
import { readProofIndex } from '../../server/public-proof/source.mjs';
const h=n=>'0x'+String(n).repeat(64);
const event=id=>({id,name:id,verifier:id+'-v1'});
const adapter=(id,resolve)=>({event:event(id),resolve});
test('a bare transaction resolves across registered events without an event or stage default',async()=>{
  const seen=[];
  const registry=createProofRegistry([adapter('first-event',async q=>{seen.push(q);return null;}),adapter('another-event',async q=>{seen.push(q);return {kind:'draw',tx:q.tx};})]);
  const result=await registry.resolve({tx:h(1)});
  assert.equal(result.event.id,'another-event');assert.equal(result.record.tx,h(1));
  assert.deepEqual(seen,[{tx:h(1)},{tx:h(1)}]);
});
test('an explicit event is a constraint; it never switches to another registered event',async()=>{
  const registry=createProofRegistry([adapter('first-event',async()=>null),adapter('another-event',async()=>({kind:'draw'}))]);
  await assert.rejects(registry.resolve({tx:h(1),event:'first-event'}),e=>e.code==='proof_not_found');
  await assert.rejects(registry.resolve({tx:h(1),event:'missing-event'}),e=>e.code==='proof_event_not_supported');
});
test('duplicate matches and unavailable sources cannot silently select a proof',async()=>{
  await assert.rejects(createProofRegistry([adapter('one',async()=>({})),adapter('two',async()=>({}))]).resolve({tx:h(1)}),e=>e.code==='proof_identity_ambiguous');
  await assert.rejects(createProofRegistry([adapter('one',async()=>({})),adapter('two',async()=>{throw Error('unavailable');})]).resolve({tx:h(1)}),/unavailable/);
  assert.throws(()=>createProofRegistry([adapter('one',async()=>null),adapter('one',async()=>null)]));
});
const env={MERCH_WORLDS_PROOF_ORIGIN:'https://event.test'};
const published={stage:'quarter',roundId:h(2),requestTx:h(3),bundleHash:h(4),status:'published'};
function worlds({rows=[published],readTransaction=async()=>null,capture=()=>{}}={}){
 return createWorldsProofAdapter({environment:env,readTransaction,fetchPublic:async(url,options)=>{
   capture(url,options);const stage=new URL(url).pathname.split('/')[4];
   return Response.json({stage,rounds:rows.filter(r=>r.stage===stage)});
 }});
}
test('request transaction lookup pins historical stage, round and exact bundle',async()=>{
 const calls=[];const result=await worlds({capture:(url,options)=>calls.push({url,options})}).resolve({tx:h(3)});
 assert.deepEqual(result,{kind:'draw',stage:'quarter',tx:h(3),bundleHash:h(4),roundId:h(2),transaction:h(3)});
 assert.equal(calls.length,3);
 for(const {url,options} of calls){assert.ok(url.startsWith('https://event.test/api/ecvrf/rounds/'));assert.equal(options.redirect,'error');assert.deepEqual(options.headers,{Accept:'application/json'});}
});
test('history lookup never substitutes the latest result for an unknown transaction',async()=>{
 assert.equal(await worlds().resolve({tx:h(9)}),null);
 assert.equal(await worlds().resolve({tx:h(3),stage:'semi'}),null);
 await assert.rejects(worlds().resolve({tx:h(3),bundleHash:h(8)}),e=>e.code==='proof_record_changed');
});
test('commitment transactions locate the same published request without changing its proof',async()=>{
 const result=await worlds({readTransaction:async()=>({kind:'draw',roundId:h(2),tx:h(5)})}).resolve({tx:h(5)});
 assert.equal(result.tx,h(3));assert.equal(result.transaction,h(5));assert.equal(result.bundleHash,h(4));
});
test('a real transaction without a published proof stays unpublished',async()=>{
 await assert.rejects(worlds({rows:[],readTransaction:async()=>({kind:'draw',roundId:h(2)})}).resolve({tx:h(5)}),e=>e.code==='proof_not_published');
});
test('equivalent RPC origins and duplicate observations do not create an ambiguous transaction',async()=>{
 const address='0x1111111111111111111111111111111111111111',code='0x6000';
 const iface=new Interface(['event RoundRequested(bytes32 indexed roundId,uint256 requestBlock)']);
 const event=iface.encodeEventLog(iface.getEvent('RoundRequested'),[h(2),90]);
 const authority={chainId:56,contract:address,publicRpc:'https://rpc.test',runtimeHash:keccak256(code)};
 const calls=[];
 const providerFor=source=>{calls.push(source.publicRpc);return {
   getNetwork:async()=>({chainId:56n}),
   getTransactionReceipt:async()=>({status:1,to:address,blockNumber:90,blockHash:h(9),logs:[{address,...event}]}),
   getBlock:async block=>({number:block==='finalized'?100:block,hash:h(9)}),
   getCode:async(address,block)=>{assert.equal(block,100,'Read code at the finalized checkpoint, not a pruned historic state');return code;},destroy(){}
 };};
 const result=await readApprovedTransaction([authority,{...authority,publicRpc:'https://rpc.test/'}],h(5),providerFor);
 assert.equal(calls.length,1);assert.equal(result.roundId,h(2));assert.equal(result.kind,'draw');
 calls.length=0;
 assert.equal((await readApprovedTransaction([authority,{...authority,publicRpc:'https://second-rpc.test'}],h(5),providerFor)).roundId,h(2));
 assert.equal(calls.length,2);
 await assert.rejects(readApprovedTransaction([{...authority,runtimeHash:h(8)}],h(5),providerFor),e=>e.code==='proof_authority_mismatch');
});
test('a roster commitment resolves its exact match and snapshot without a draw result',async()=>{
 const result=await worlds({rows:[],readTransaction:async()=>({kind:'roster',matchKey:keccak256(toUtf8Bytes('worlds-2026:qf-02')),snapshotHash:h(6)})}).resolve({tx:h(5)});
 assert.deepEqual(result,{kind:'roster',stage:'quarter',match:'qf-02',snapshotHash:h(6),transaction:h(5)});
 assert.equal(await worlds({rows:[],readTransaction:async()=>({kind:'roster',matchKey:h(7),snapshotHash:h(6)})}).resolve({tx:h(5)}),null);
});
test('invalid source indices fail instead of granting the source any authority',async()=>{
 for(const value of [{stage:'quarter',rounds:null},{stage:'quarter',rounds:[{...published,requestTx:'bad'}]}]){
   const a=createWorldsProofAdapter({environment:env,fetchPublic:async()=>Response.json(value),readTransaction:async()=>null});
   await assert.rejects(a.resolve({tx:h(3),stage:'quarter'}),e=>e.code==='proof_history_invalid');
 }
});
test('a broken index stream retains its public source error even when cancellation also rejects',async()=>{
 for(const status of [200,503]){
  const body=new ReadableStream({start(controller){controller.error(new Error('connection closed'));}});
  await assert.rejects(readProofIndex('https://event.test','/api/ecvrf/rounds/final/history',async()=>new Response(body,{status,headers:{'content-type':'application/json'}})),e=>e.status===502&&e.code==='proof_source_unavailable');
 }
});
function response(){return {writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=JSON.parse(body);}};}
test('lookup HTTP route is public, strict, bounded to registered adapters and not cached',async()=>{
 const route=createProofLookupRoutes({adapters:[adapter('another-event',async q=>({kind:'draw',tx:q.tx}))]});
 const res=response();assert.equal(await route({method:'GET'},res,new URL('https://merch.test/api/public-proofs/resolve?tx='+h(1))),true);
 assert.equal(res.status,200);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.body.event.id,'another-event');
 for(const query of ['', '?tx=bad','?tx='+h(1)+'&tx='+h(2),'?tx='+h(1)+'&url=https://attacker.test','?tx='+h(1)+'&event=https://attacker.test','?bundleHash=']){
   await assert.rejects(route({method:'GET'},response(),new URL('https://merch.test/api/public-proofs/resolve'+query)),e=>e.code==='proof_query_invalid');
 }
 await assert.rejects(route({method:'POST'},response(),new URL('https://merch.test/api/public-proofs/resolve?tx='+h(1))),e=>e.status===405);
});
