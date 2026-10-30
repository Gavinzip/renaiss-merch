// Independent, read-only verifier. The expected contract comes from the caller,
// never from the event website's own claim. RPC credentials are never printed.
import {readFile} from 'node:fs/promises';
import {FetchRequest,JsonRpcProvider} from 'ethers';
import {verifyBundle,same,requireThat} from '../shared/public-proof/worlds/protocol.mjs';
import {collectChainFacts,RUNTIME_HASH,supportedRuntime} from '../shared/public-proof/worlds/chain.mjs';
import {assertEventAuthority} from '../shared/public-proof/worlds/authority.mjs';
const [source,expectedContract,expectedChain,expectedRuntime=RUNTIME_HASH]=process.argv.slice(2);
if(!source||!expectedContract||!expectedChain||!process.env.ECVRF_VERIFY_RPC)throw new Error('Usage: ECVRF_VERIFY_RPC=<your RPC> node scripts/verify-ecvrf.mjs <proof.json or bundle URL> <approved contract> <approved chain ID: 56 or 97>');
if(!supportedRuntime(expectedRuntime))throw new Error('Supply a reviewed contract runtime hash.');
const registry={chainId:Number(expectedChain),contract:expectedContract,runtimeHash:expectedRuntime};
let provider;
try{
  const bundle=/^https?:\/\//.test(source)?await (async()=>{const r=await fetch(source,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Proof download failed (${r.status}).`);return r.json();})():JSON.parse(await readFile(source,'utf8'));
  assertEventAuthority(bundle,registry);
  const math=verifyBundle(bundle),request=new FetchRequest(process.env.ECVRF_VERIFY_RPC);request.timeout=15000;
  provider=new JsonRpcProvider(request,undefined,{batchMaxCount:1});
  const chain=await collectChainFacts(provider,registry,bundle.commitment,bundle.chain);
  for(const [key,value] of Object.entries(chain))requireThat(typeof value==='number'?bundle.chain[key]===value:same(String(value),bundle.chain[key]),`Chain evidence mismatch: ${key}`);
  console.log(JSON.stringify({verified:true,chainId:chain.chainId,contract:expectedContract,root:math.root,manifestHash:math.manifestHash,resultHash:math.resultHash,bundleHash:math.bundleHash,picks:math.picks.map(({matchId,ticketNumber,rank})=>({matchId,ticketNumber,rank}))},null,2));
}catch(error){console.error(JSON.stringify({verified:false,error:error.code?'Chain or network verification failed.':error.message}));process.exitCode=1;}
finally{provider?.destroy();}
