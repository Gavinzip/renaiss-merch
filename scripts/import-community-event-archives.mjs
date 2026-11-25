// Import only published results and the original prize/winner presentation.
// Run explicitly while the source is available; the delivered pages are static.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import sharp from 'sharp';
import { verifyBundle } from '../shared/public-proof/worlds/protocol.mjs';

const root = process.cwd();
const original = process.env.WORLDS_ARCHIVE_SOURCE || '/Users/gavin/.codex/worktrees/worlds-auto-results/lol competion';
const origin = 'https://renaiss-lol.vercel.app';
const assets = {}, sources = [], imported = new Set();
let presentationText='';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pick = (value, fields) => Object.fromEntries(fields.map(key => [key, value[key]]));
async function save(file, bytes) { await fs.mkdir(path.dirname(file), {recursive:true}); await fs.writeFile(file, bytes); }
async function json(file, value) { await save(path.join(root, file), JSON.stringify(value, null, 2) + '\n'); }
async function get(url) { const response = await fetch(url, {signal:AbortSignal.timeout(30_000)}); if (!response.ok) throw new Error(`Archive source HTTP ${response.status}: ${url}`); return response; }
async function asset(key, bytes, contentType) {
  const source = 'work/assets/community-event-archives/' + key;
  await save(path.join(root, source), bytes);
  assets[key] = {path:key, source, type:'binary', bytes:bytes.length, sha256:sha(bytes), contentType};
  return key;
}
async function originalAsset(key, source, contentType) { return asset(key, await fs.readFile(path.join(original, source)), contentType); }
const [bootstrap, registry, surf] = await Promise.all([
  get(origin + '/api/bootstrap').then(response => response.json()),
  get(origin + '/api/ecvrf/rounds').then(response => response.json()),
  fs.readFile(path.join(root, 'src/event-archives/data/surf.json'), 'utf8').then(JSON.parse),
]);
if (surf.status !== 'complete' || surf.winners.length !== 27 || surf.prizes.length !== 27 ||
  surf.winners.some(winner => Object.keys(winner).sort().join(',') !== 'name,slot,ticketNumber')) throw new Error('Surf requires a complete allowlisted verified result.');
await json('src/event-archives/data/surf.json', surf);

const rounds = await Promise.all(registry.rounds.map(async round => {
  if (round.status !== 'published' || round.privateReview || !['quarter','semi','final'].includes(round.stage)) throw new Error('Only published public Worlds rounds may be archived.');
  const raw = Buffer.from(await (await get(new URL(round.proofUrl, origin))).arrayBuffer());
  if (sha(raw) !== round.bundleHash.slice(2)) throw new Error('Worlds proof byte hash mismatch.');
  const bundle = JSON.parse(raw);
  if (/"(?:email|accessToken|refreshToken|privateKey|userSub)"\s*:/i.test(raw.toString())) throw new Error('Unexpected private metadata in published proof.');
  const verified = verifyBundle(bundle, round.bundleHash);
  if (verified.picks.some(winner => winner.rank !== 0 || winner.positionType !== 'winner')) throw new Error('Unexpected alternate in Worlds public result.');
  for (const winner of verified.picks) {
    const draw = bootstrap.draws.find(draw => draw.matchId === winner.matchId);
    if (!draw || draw.source !== 'ecvrf' || draw.winners.length !== 1 || draw.winners[0].ticketNumber !== winner.ticketNumber) throw new Error('Worlds public display differs from its proof.');
  }
  const proofAsset = await asset(`worlds-2026/proofs/${round.stage}.json`, raw, 'application/json');
  return {...pick(round, ['stage','roundId','bundleHash','requestTx','publishedAt']), proofAsset, winnerCount:verified.picks.length};
}));
if (rounds.length !== 3 || rounds.reduce((sum, round) => sum + round.winnerCount, 0) !== 7) throw new Error('Worlds needs all seven published winners.');
const matches = bootstrap.matches.map(match => pick(match, ['id','stage','teamA','teamB','startsAt','prizeId']));
const usedTeams = new Set(matches.flatMap(match => [match.teamA, match.teamB]));
const teams = await Promise.all(bootstrap.teams.filter(team => usedTeams.has(team.id)).map(async team => {
  const url = new URL(team.logoUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'static.lolesports.com') throw new Error('Review new team logo source before import.');
  const response = await get(url), bytes = Buffer.from(await response.arrayBuffer());
  // Some official PNGs are served as binary/octet-stream. Determine and retain
  // their actual decoded format; never save HTML/error bodies as logo images.
  const format = (await sharp(bytes).metadata()).format;
  const contentType = {png:'image/png',webp:'image/webp',svg:'image/svg+xml',jpeg:'image/jpeg'}[format];
  const extension = {png:'png',webp:'webp',svg:'svg',jpeg:'jpg'}[format];
  if (!extension) throw new Error('Unsupported original team logo.');
  const logoAsset = await asset(`worlds-2026/teams/${team.id}.${extension}`, bytes, contentType);
  return {...pick(team,['id','name','color']), logoAsset};
}));
const draws = bootstrap.draws.map(draw => {
  if (draw.rehearsal || draw.source !== 'ecvrf') throw new Error('Not an official published draw.');
  return {...pick(draw,['id','matchId','source','ledgerHash','totalTickets','createdAt']),
    winners:draw.winners.map(winner => pick(winner,['ticketNumber','position','rank','name','xUsername']))};
});
await json('src/event-archives/data/worlds-2026.json', {capturedAt:new Date().toISOString(), sourceUrl:origin,
  stages:bootstrap.campaign.stages, prizes:bootstrap.campaign.prizes.map(prize => pick(prize,['id','productId','stage','type','name','language','contents','slots','unitsPerWinner','unit','color'])), matches, teams, draws, rounds});

await Promise.all([
  originalAsset('worlds-2026/background.webp','src/features/renaiss/hero-intro/duel/assets/background.webp','image/webp'),
  originalAsset('worlds-2026/cup.webp','src/features/renaiss/hero-intro/duel/assets/cup.webp','image/webp'),
  originalAsset('worlds-2026/wordmark.webp','src/features/renaiss/brand/assets/renaiss-wordmark-white.webp','image/webp'),
  originalAsset('worlds-2026/origins-tc.jpg','src/features/renaiss/prizes/assets/origins-tc-model.jpg','image/jpeg'),
  originalAsset('worlds-2026/unleashed-cn.webp','src/features/renaiss/prizes/assets/unleashed-cn.webp','image/webp'),
  originalAsset('worlds-2026/origins-en.webp','src/features/renaiss/prizes/assets/origins-en-model.webp','image/webp'),
]);
presentationText=JSON.stringify({stages:bootstrap.campaign.stages,prizes:bootstrap.campaign.prizes})+(await Promise.all([
  'src/features/renaiss/winners/WinnersShowcase.tsx','src/features/renaiss/winners/WinnerMatch.tsx',
  'src/features/renaiss/winners/WinnerPrizeDisplay.tsx','src/components/TeamMark.tsx',
].map(file=>fs.readFile(path.join(original,file),'utf8')))).join('\n');

async function resolveSource(base) {
  for (const file of [base,...['.ts','.tsx','.js','.jsx','.json','.css'].map(ext=>base+ext)]) {
    if (await fs.stat(file).then(stat=>stat.isFile()).catch(()=>false)) return file;
  }
  throw new Error('Missing presentation dependency: '+base);
}
async function copy(relative) {
  const source = await resolveSource(path.join(original, relative));
  if (imported.has(source)) return;
  imported.add(source);
  const relativeSource = path.relative(original,source);
  const destination = path.join(root,'src/event-archives/worlds-2026/original',relativeSource.replace(/\.tsx?$/,'.js'));
  const raw = await fs.readFile(source,'utf8');
  let code = raw;
  if (relativeSource.endsWith('i18n/catalog.json')) {
    const catalog=JSON.parse(raw);
    const used=Object.entries(catalog).filter(([key])=>{
      const parts=key.split(/\{\w+\}/g).map(part=>part.trim()).filter(Boolean);
      return parts.length>0 && parts.every(part=>presentationText.includes(part));
    });
    code=JSON.stringify(Object.fromEntries(used),null,2)+'\n';
  }
  if (relativeSource.endsWith('WinnersShowcase.tsx')) {
    code = code.replace("import {useSearchParams} from 'react-router-dom';",'')
      .replace("import {RoomEntry} from '../presentation/RoomMotion';", `import {ArchiveEntry as RoomEntry} from '../../../../../../shared/ArchiveEntry';`)
      .replace('teams,draws,proofLinks,onClaim','teams,draws,proofLinks,activeStage')
      .replace("  const [params]=useSearchParams();\n",'').replace("params.get('stage')",'activeStage')
      .replace(' onClaim={onClaim}','');
  }
  if (relativeSource.endsWith('WinnerMatch.tsx')) {
    code = "import {useI18n} from '../../../i18n/I18nProvider';\n" + code;
    code = code.replace('  const winners = draw', '  const {text}=useI18n();\n  const winners = draw')
      .replace("{draw.rehearsal ? '主網演練 · 測試名冊 · 不發放獎品' : draw.source === 'preview' ? '本機示範抽獎' : draw.source==='ecvrf'?'ECVRF 證明已核對':'鏈上已驗證'}", "{text('ECVRF 證明已核對')}")
      .replace(', onClaim}', '}').replace('onClaim: (draw: Draw) => void;', '')
      .replaceAll('<TeamMark id=', '<TeamMark teams={teams} id=')
      .replace('className={`is-primary${winner.isMe ? \' is-me\' : \'\'}`}', 'className="is-primary"')
      .replace('{winner.isMe && <em>你</em>}','')
      .replace(/\s*\{winner\.isMe && winner\.position === 'winner' && <button[^\n]+<\/button>\}/,'');
  }
  if (relativeSource.endsWith('TeamMark.tsx')) {
    code = code.replace('import { useApp } from "../lib/AppContext";', '')
      .replace('  id,\n','  id, teams,\n').replace('  id: string | null;', '  id: string | null; teams: any[];')
      .replace('  const { data } = useApp(),\n    team = data.teams.find', '  const team = teams.find');
  }
  if (relativeSource.endsWith('lib/api.ts')) {
    const start=raw.indexOf('export const number =');
    code=raw.slice(start,raw.indexOf('export const statusName',start));
  }
  if (relativeSource.endsWith('prizes/productMedia.ts')) {
    code=`import { communityArchiveAssetUrl } from '../../../../../../shared/communityArchiveAssets';
const media={'origins-tc':'origins-tc.jpg','unleashed-cn':'unleashed-cn.webp','origins-en':'origins-en.webp'};
export function getProductMedia(id){if(!media[id])throw new Error('Unknown archived prize');return {modelImage:communityArchiveAssetUrl('worlds-2026/'+media[id])};}`;
  }
  if (relativeSource.endsWith('i18n/I18nProvider.ts')) {
    code=code.replace('function storedLocale():Locale{', `function storedLocale():Locale{
  const requested=new URLSearchParams(location.search).get('lang');
  if(requested==='zh-TW'||requested==='zh-Hant')return 'zh-Hant';
  if(requested==='en'||requested==='ko')return requested;`)
      .replace('document.documentElement.lang=locale;', `document.documentElement.lang=locale;
    const url=new URL(location.href);url.searchParams.set('lang',locale==='zh-Hant'?'zh-TW':locale);history.replaceState(history.state,'',url);`);
  }
  if (source.endsWith('.css')) {
    code=code.replace('outline:2px solid #e1cb97;outline-offset:4px;border-radius:2px','outline:none;text-decoration:underline;text-underline-offset:4px');
  } else if (!source.endsWith('.json')) {
    // Eliminate type-only dependencies before traversing the real runtime graph.
    const i18n=path.relative(path.dirname(destination),path.join(root,'src/event-archives/worlds-2026/original/src/i18n')).replaceAll('\\','/');
    code=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,jsxImportSource:i18n.startsWith('.')?i18n:'./'+i18n},fileName:source}).outputText;
    for (const match of [...code.matchAll(/(?:from\s*|import\s*)(["'])(\.[^"']+)\1/g)]) {
      if (match[2].includes('/shared/ArchiveEntry') || match[2].includes('/shared/communityArchiveAssets')) continue;
      if (match[2].endsWith('/jsx-runtime')) continue;
      const dependency=await resolveSource(path.resolve(path.dirname(source),match[2]));
      await copy(path.relative(original,dependency));
    }
  }
  await save(destination,code);
  sources.push({source:relativeSource,sha256:sha(raw),destination:path.relative(root,destination),adapted:code!==raw});
}
for(const relative of ['src/features/renaiss/winners/WinnersShowcase.tsx','src/features/renaiss/winners/winners-showcase.css','src/i18n/I18nProvider.ts','src/i18n/jsx-runtime.ts','src/features/renaiss/football-competition-toolbar.css']) await copy(relative);
await json('media/community-event-archive-asset-release.json',{release:'unpublished',prefix:'community-event-archives',assets});
await json('docs/community-event-archive-provenance.json',{sourceCheckout:original,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:original,encoding:'utf8'}).trim(),sourceDirty:Boolean(execFileSync('git',['status','--porcelain'],{cwd:original,encoding:'utf8'}).trim()),sources});
console.log(`Archived Surf 27 and Worlds 7 published slots, ${rounds.length} verified original proofs, ${sources.length} presentation files and ${Object.keys(assets).length} media objects.`);
