import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyBundle} from '../../shared/public-proof/worlds/protocol.mjs';
const read = async file => JSON.parse(await fs.readFile(new URL('../../'+file,import.meta.url),'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('Surf archive retains all 27 unique tickets and no participant contacts',async()=>{
 const data=await read('src/event-archives/data/surf.json');
 assert.equal(data.status,'complete');assert.equal(data.winners.length,27);
 assert.equal(new Set(data.winners.map(w=>w.slot)).size,27);assert.equal(new Set(data.winners.map(w=>w.ticketNumber)).size,27);
 assert.equal(data.prizes.filter(prize=>prize.kind==='mystery-box').length,7);
 assert.equal(data.prizes.filter(prize=>prize.kind==='surf-pro-month').length,20);
 for(const winner of data.winners){assert.deepEqual(Object.keys(winner).sort(),['name','slot','ticketNumber']);assert.doesNotMatch(winner.name,/@[^ ]+\.|^0x[a-f0-9]{40}$/i);}
 assert.doesNotMatch(JSON.stringify(data),/"(?:email|walletAddress|userSub|discordUsername|signerAddress)"/);
});
test('Worlds local winner records match all three archived cryptographic proofs',async()=>{
 const data=await read('src/event-archives/data/worlds-2026.json'),catalog=await read('media/community-event-archive-asset-release.json');
 let count=0;
 for(const round of data.rounds){
  const bytes=await fs.readFile(new URL('../../'+catalog.assets[round.proofAsset].source,import.meta.url));
  assert.equal('0x'+hash(bytes),round.bundleHash);
  const result=verifyBundle(JSON.parse(bytes),round.bundleHash);count+=result.picks.length;
  for(const pick of result.picks){const draw=data.draws.find(item=>item.matchId===pick.matchId);assert.equal(draw.winners.length,1);assert.equal(draw.winners[0].ticketNumber,pick.ticketNumber);assert.equal(draw.winners[0].position,'winner');assert.equal(draw.winners[0].rank,0);}
 }
 assert.equal(count,7);assert.equal(data.rounds.length,3);assert.equal(data.prizes.reduce((n,p)=>n+p.slots*p.unitsPerWinner,0),7);
 assert.doesNotMatch(JSON.stringify(data),/"(?:email|walletAddress|userSub|discordUsername|isMe|ssoConfigured)"/);
});
test('every necessary Worlds image and proof is retained with its actual bytes',async()=>{
 const data=await read('src/event-archives/data/worlds-2026.json'),catalog=await read('media/community-event-archive-asset-release.json');
 for(const asset of Object.values(catalog.assets)){const bytes=await fs.readFile(new URL('../../'+asset.source,import.meta.url));assert.equal(bytes.length,asset.bytes);assert.equal(hash(bytes),asset.sha256);assert.match(asset.contentType,/^(image\/|application\/json)/);}
 for(const team of data.teams)assert.ok(catalog.assets[team.logoAsset]);
 for(const file of ['WinnerMatch','WinnersShowcase']){const code=await fs.readFile(new URL('../../src/event-archives/worlds-2026/original/src/features/renaiss/winners/'+file+'.js',import.meta.url),'utf8');assert.doesNotMatch(code,/useApp|useSearchParams|onClaim|fetch\(/);}
});
test('both new archives have normal independent HTML entries and deployment routes',async()=>{
 const config=await read('vercel.json');
 for(const id of ['surf','worlds-2026']){
  const html=await fs.readFile(new URL('../../events/'+id+'/index.html',import.meta.url),'utf8');assert.match(html,new RegExp('src/event-archives/'+id+'/main.jsx'));
  for(const suffix of ['', '/'])assert.ok(config.rewrites.some(r=>r.source==='/events/'+id+suffix&&r.destination==='/events/'+id+'/index.html'));
 }
});
