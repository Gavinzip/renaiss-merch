import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {verifyBundle} from '../../src/event-archives/bbw/original/src/flagship/thailand/draw/protocol/bundle.js';
import {createBbwWinnerList} from '../../src/event-archives/bbw/winnerList.ts';
const read=async file=>JSON.parse(await fs.readFile(new URL('../../'+file,import.meta.url),'utf8'));

test('BBW preserves both verified rounds with ten records for nine distinct people',async()=>{
  const snapshot=await read('src/event-archives/data/bbw.json');
  assert.deepEqual(snapshot.rounds.map(r=>r.number),[5,6]);
  const catalog=await read('media/community-event-archive-asset-release.json');
  for(const round of snapshot.rounds){
    const asset=catalog.assets[round.proofAsset],bytes=await fs.readFile(new URL('../../'+asset.source,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
    assert.equal('0x'+asset.sha256,round.bundleHash);
    const bundle=JSON.parse(bytes),verified=verifyBundle(bundle,snapshot.authority,round.bundleHash);
    assert.equal(verified.winners.length,5);
    assert.deepEqual(round.winners.map(w=>[w.participantId,w.name,w.xUsername]),verified.winners.map(w=>[w.participantId,w.name,w.xUsername]));
    assert.deepEqual(round.winners.map(w=>w.ticketNumber),verified.result.picks.map(w=>w.ticketNumber));
    assert.deepEqual(round.winners.map(w=>w.rank),[1,2,3,4,5]);
    assert.equal(new Set(round.winners.map(w=>w.participantId)).size,5);
    assert.ok(round.winners.every(w=>w.travelLimitUsdt===1000&&w.remotePrizeUsdt===300));
  }
  const all=snapshot.rounds.flatMap(r=>r.winners);
  assert.equal(all.length,snapshot.recordCount);assert.equal(all.length,10);
  assert.equal(new Set(all.map(w=>w.participantId)).size,snapshot.uniqueWinnerCount);
  assert.equal(snapshot.uniqueWinnerCount,9);
  assert.equal(all.filter(w=>w.xUsername==='deitycat2002').length,2);
  assert.doesNotMatch(JSON.stringify(snapshot),/"(?:email|subject|userSub|accessToken|privateKey|wallet|spending|sbtCount)"\s*:/i);
});

test('BBW presentation lists nine people once while retaining every original ticket',async()=>{
  const snapshot=await read('src/event-archives/data/bbw.json'),original=JSON.stringify(snapshot);
  const people=createBbwWinnerList(snapshot.rounds);
  assert.equal(people.length,9);
  assert.equal(new Set(people.map(w=>w.participantId)).size,9);
  assert.deepEqual(people.map(w=>w.displayNumber),[1,2,3,4,5,6,7,8,9]);
  assert.deepEqual(people.flatMap(w=>w.tickets).sort((a,b)=>a-b),snapshot.rounds.flatMap(r=>r.winners.map(w=>w.ticketNumber)).sort((a,b)=>a-b));
  assert.deepEqual(people.find(w=>w.xUsername==='deitycat2002').tickets,[3371,3588]);
  assert.equal(JSON.stringify(snapshot),original);
});

test('BBW uses self-contained original media and an independent routed document',async()=>{
  const catalog=await read('media/community-event-archive-asset-release.json');
  for(const [key,asset]of Object.entries(catalog.assets).filter(([key])=>key.startsWith('bbw/'))){
    const bytes=await fs.readFile(new URL('../../'+asset.source,import.meta.url));
    assert.equal(bytes.length,asset.bytes,key);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,key);
  }
  const logo=catalog.assets['bbw/renaiss-transparent.webp'];
  assert.ok(logo);
  const logoFile=new URL('../../'+logo.source,import.meta.url);
  assert.equal((await sharp(logoFile.pathname).metadata()).hasAlpha,true);
  assert.equal((await sharp(logoFile.pathname).stats()).isOpaque,false);
  const main=await fs.readFile(new URL('../../src/event-archives/bbw/main.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(main,/api\/bbw-draw|start-draw|recordWinnerReveal|submission|signTransaction/);
  const config=await read('vercel.json');
  assert.ok(config.rewrites.some(r=>r.source==='/events/bbw/'&&r.destination==='/events/bbw/index.html'));
  const html=await fs.readFile(new URL('../../events/bbw/index.html',import.meta.url),'utf8');
  assert.match(html,/\/src\/event-archives\/bbw\/main.jsx/);
});
