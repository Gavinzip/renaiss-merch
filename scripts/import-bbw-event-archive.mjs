// Explicit read-only capture. Run from the BBW checkout with its private env:
// BBW_ARCHIVE_CURRENT_ROUND=6 node --experimental-transform-types \
//   --env-file-if-exists=.env.local /absolute/merch/scripts/import-bbw-event-archive.mjs
// No operator, signer, release or reveal operation is called.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';

const target=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const source=process.cwd(),current=Number(process.env.BBW_ARCHIVE_CURRENT_ROUND);
if(!Number.isSafeInteger(current)||current<2)throw new Error('Specify the reviewed current BBW round.');
const requireSource=createRequire(path.join(source,'package.json'));
const postgres=requireSource('postgres');
const {JsonRpcProvider,FetchRequest}=requireSource('ethers');
const fromSource=file=>import(pathToFileURL(path.join(source,file)).href);
const [{loadDrawDataSource},{loadDrawProfile},{verifyBundle},{verifyChain},{canonical,digest}]=await Promise.all([
  fromSource('services/bbw-draw/data-source.ts'),fromSource('services/bbw-draw/profile.ts'),
  fromSource('src/flagship/thailand/draw/protocol/bundle.ts'),fromSource('services/bbw-draw/chain.ts'),
  fromSource('src/flagship/thailand/draw/protocol/encoding.ts'),
]);
const env=await loadDrawDataSource(await loadDrawProfile(process.env));
const authority={chainId:Number(env.BBW_DRAW_CHAIN_ID),contract:env.BBW_DRAW_CONTRACT_ADDRESS,publicKey:env.BBW_DRAW_PUBLIC_KEY,
  runtimeHash:'0x51d2ae9c45d66a149e5ece28547e3a9c0cbdbbe8b594cd8f3e4b4478d9e458b4'};
if(authority.chainId!==56||!authority.contract||!authority.publicKey||!env.BBW_DRAW_RPC_URL)throw new Error('Missing independent official BBW verification settings.');
const sql=postgres(env.BBW_SUBMISSION_DATABASE_URL,{max:1});
let records;
try {
  records=await sql.begin('read only',async tx=>{
    const keys=[current-1,current].flatMap(n=>['bundle','release','superseded',...Array.from({length:5},(_,i)=>`presentation:revealed:${i+1}`)].map(k=>`round:${n}:${k}`));
    const rows=await tx`SELECT key,value FROM bbw_draw_records WHERE key IN ${tx(keys)} OR key LIKE 'rounds:active:%'`;
    return new Map(rows.map(row=>[row.key,typeof row.value==='string'?JSON.parse(row.value):row.value]));
  });
} finally {await sql.end();}
const active=Math.max(1,...[...records].filter(([key])=>key.startsWith('rounds:active:')).map(([,value])=>value.roundNumber));
if(active!==current)throw new Error('The current BBW round changed. Review it before capturing.');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
const assets={},sources=[];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function save(file,bytes){const out=path.join(target,file);await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,bytes);}
async function asset(key,bytes,contentType){const file='work/assets/community-event-archives/'+key;await save(file,bytes);assets[key]={path:key,source:file,type:'binary',bytes:bytes.length,sha256:hash(bytes),contentType};return key;}
const request=new FetchRequest(env.BBW_DRAW_RPC_URL);request.timeout=12000;
const provider=new JsonRpcProvider(request,undefined,{batchMaxCount:1,cacheTimeout:-1});
const rounds=[];
try {
  for(const number of [current-1,current]){
    const prefix=`round:${number}:`,bundle=records.get(prefix+'bundle'),release=records.get(prefix+'release');
    if(!bundle||!release||records.get(prefix+'superseded'))throw new Error('Only released, valid BBW rounds may be archived.');
    verifyBundle(bundle,authority,release.bundleHash);
    const observed=await verifyChain(provider,authority,bundle.commitment,bundle.chain);
    if(canonical(observed)!==canonical(bundle.chain))throw new Error('BBW finalized chain evidence differs.');
    for(let i=0;i<5;i++){
      const reveal=records.get(prefix+`presentation:revealed:${i+1}`);
      if(reveal?.rank!==i+1||reveal.bundleHash!==release.bundleHash||reveal.participantId!==bundle.winners[i].participantId)throw new Error('Every archived BBW winner must already be revealed.');
    }
    const raw=Buffer.from(canonical(bundle));
    if('0x'+hash(raw)!==release.bundleHash||/"(?:email|subject|accessToken|privateKey|raw)"\s*:/i.test(raw.toString()))throw new Error('BBW public proof failed its hash/privacy boundary.');
    const proofAsset=await asset(`bbw/proofs/round-${number}.json`,raw,'application/json');
    rounds.push({number,roundId:bundle.commitment.roundId,bundleHash:release.bundleHash,root:bundle.commitment.root,
      ticketCount:bundle.commitment.ticketCount,cutoffAt:bundle.manifest.cutoffAt,proofAsset,
      commitmentTx:bundle.chain.commitmentTx,requestTx:bundle.chain.requestTx,
      winners:bundle.result.picks.map((pick,i)=>({...bundle.winners[i],rank:pick.rank+1,ticketNumber:pick.ticketNumber,...bundle.manifest.prizes[i]}))});
  }
} finally {provider.destroy();}
const uniqueWinnerCount=new Set(rounds.flatMap(round=>round.winners.map(w=>w.participantId))).size;
if(uniqueWinnerCount!==9||rounds.some(r=>r.winners.length!==5))throw new Error('The reviewed nine-winner/two-round scope differs.');

for(const [name,file,mime] of [
  ['venue.webp','src/flagship/assets/thailand/qsncc-venue-aerial-2560.webp','image/webp'],
  ['renaiss.webp','src/flagship/assets/affiliations/renaiss-protocol-lockup.webp','image/webp'],
  ['fourmeme.webp','src/flagship/assets/thailand/bbw/four-meme-wordmark.webp','image/webp'],
  ['renaiss-transparent.webp','public/assets/partners/renaiss-protocol.webp','image/webp'],
  ['fourmeme-dark.svg','src/flagship/assets/thailand/bbw/four-meme-wordmark-light.svg','image/svg+xml'],
])await asset('bbw/'+name,await fs.readFile(path.join(source,file)),mime);

// Copy the original small card renderer and independently replayable protocol.
// No operator UI, SSO, submission workflow, transaction signer or live API is imported.
const files=new Set();
async function copy(file){
  if(files.has(file))return;files.add(file);
  const bytes=await fs.readFile(path.join(source,file)),raw=bytes.toString();
  let code=ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const dependencies=[...code.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)].map(match=>match[1]).filter(item=>item.startsWith('.'));
  for(const item of dependencies){const base=path.join(path.dirname(file),item);const dep=path.extname(base)?base:base+'.ts';await copy(dep);code=code.replaceAll(`'${item}'`,`'${item.replace(/\.ts$/,'.js')}'`).replaceAll(`"${item}"`,`"${item.replace(/\.ts$/,'.js')}"`);}
  await save('src/event-archives/bbw/original/'+file.replace(/\.ts$/,'.js'),code);
  sources.push({path:file,sha256:hash(bytes)});
}
const base='src/flagship/thailand/draw/';
for(const file of ['presentation/artwork/travelCardArtwork.ts','presentation/drawCopy.ts','protocol/bundle.ts'])await copy(base+file);
await save('src/event-archives/bbw/original/LICENSE',await fs.readFile(path.join(source,base+'protocol/vendor/LICENSE')));
const snapshot={id:'bbw',capturedAt:new Date().toISOString(),sourceCommit,currentRound:current,uniqueWinnerCount,recordCount:10,authority,rounds,
  venueDates:'2026.11.28 — 11.29',cutoffAt:rounds[0].cutoffAt,source:'https://renaiss-fourmeme-bbw.vercel.app'};
await save('src/event-archives/data/bbw.json',JSON.stringify(snapshot,null,2)+'\n');
const catalogFile=path.join(target,'media/community-event-archive-asset-release.json');
const catalog=JSON.parse(await fs.readFile(catalogFile,'utf8'));
if(catalog.release!=='unpublished')throw new Error('Prepare a new immutable media release before adding BBW.');
// The opaque copy remains in work as provenance, outside the runtime catalog.
delete catalog.assets['bbw/renaiss-dark.webp'];
catalog.assets={...catalog.assets,...assets};
await save('media/community-event-archive-asset-release.json',JSON.stringify(catalog,null,2)+'\n');
await save('docs/bbw-event-archive-provenance.json',JSON.stringify({source,sourceCommit,capturedAt:snapshot.capturedAt,rounds:rounds.map(r=>({number:r.number,bundleHash:r.bundleHash,requestTx:r.requestTx})),sources,assets:Object.keys(assets),readOnly:true},null,2)+'\n');
console.log(JSON.stringify({currentRound:current,rounds:rounds.map(r=>r.number),uniqueWinnerCount,recordCount:10,assets:Object.keys(assets).length,sourceFiles:sources.length}));
