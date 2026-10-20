// Read-only source import. Runtime media stays outside public/dist until CDN release.
import { readFile, writeFile, mkdir, stat, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import postcss from 'postcss';

const root = process.cwd();
const sources = {
  'pokemon-30': '/Users/gavin/Documents/ChatGPT/30th-ann-recovery-release',
  football: '/Users/gavin/renaiss_bnb_football',
};
let previousAssets = {};
try {
  previousAssets = JSON.parse(await readFile(path.join(root, 'media/event-experience-asset-release.json'), 'utf8')).assets;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const imported = new Set(), provenance = [];
// A source-only refresh must not temporarily invalidate the current public-data snapshot.
const assets = Object.fromEntries(Object.entries(previousAssets).filter(([key]) => /\/(?:data|avatars)\//.test(key)));
const helper = path.join(root, 'src/event-archives/shared/archiveAssets.js');
const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.css'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function save(file, content) {
  try { if (await readFile(file, 'utf8') === content) return; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}
async function resolveFile(base) {
  for (const candidate of [base, ...codeExtensions.map(ext => base + ext)]) {
    if (await stat(candidate).then(s => s.isFile()).catch(() => false)) return candidate;
  }
  throw new Error('Missing original runtime source: ' + base);
}
async function copyAsset(id, file, relative) {
  const key = id + '/' + relative.replaceAll('\\', '/');
  const destination = path.join(root, 'work/assets/event-experiences', key);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(file, destination);
  const bytes = await readFile(file);
  assets[key] = { path: key, bytes: bytes.length, sha256: digest(bytes) };
  return key;
}
function footballStyles(css) {
  const sheet = postcss.parse(css);
  const used = /\.(?:control-room|control-header|brand-lockup|command-menu|pill-nav|language-switch|header-wallet|mobile-nav-toggle|room-shell|round-simulator|round-switch|round-tab|round-tabs|round-rail|round-chip|round-mode|winner[-s]|winners-|home-room|home-video|hero-stage|hero-copy|hero-actions|hero-action|renaiss-metal|glare-hover|magnet|side-rays)/;
  sheet.walkComments(comment => comment.remove());
  sheet.walkRules(rule => {
    if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    if (rule.selector.includes('.') && !used.test(rule.selector)) rule.remove();
  });
  sheet.walkAtRules(rule => { if (rule.nodes && !rule.nodes.length) rule.remove(); });
  return sheet.toString();
}
async function copySource(id, relative, override) {
  const source = await resolveFile(path.join(sources[id], relative));
  if (imported.has(source)) return;
  imported.add(source);
  const destinationRelative = path.relative(sources[id], source).replace(/\.tsx?$/, '.js');
  const destination = path.join(root, 'src/event-archives', id, 'original', destinationRelative);
  const original = await readFile(source, 'utf8');
  let code = override ?? original;
  if (source.endsWith('WinnersRoom.jsx')) {
    code = code.replace(/function localApiEndpoint\(path\) \{[\s\S]*?\n\}/, 'function localApiEndpoint(path) { return path; }');
  }
  if (id === 'football' && source.endsWith('I18nProvider.jsx')) {
    code = code.replace('  const stored = window.localStorage.getItem(STORAGE_KEY);', `  const requested = new URLSearchParams(window.location.search).get('lang');
  const normalized = requested === 'zh-TW' ? 'zh-Hant' : requested;
  if (LOCALES.some(option => option.id === normalized)) return normalized;
  const stored = window.localStorage.getItem(STORAGE_KEY);`);
    code = code.replace('    window.localStorage.setItem(STORAGE_KEY, locale);', `    window.localStorage.setItem(STORAGE_KEY, locale);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', locale === 'zh-Hant' ? 'zh-TW' : locale);
    window.history.replaceState(null, '', url);`);
  }
  const sourceRecord = { event: id, source: path.relative(sources[id], source), sha256: digest(original), adapted: false };
  provenance.push(sourceRecord);
  if (source.endsWith('.css')) {
    code = code.replace(/@import\s+["']@fontsource[^;]+;/g, '');
    if (id === 'football') code = footballStyles(code);
    sourceRecord.adapted = code !== original;
    await save(destination, code);
    return;
  }
  let usesAssetHelper = false;
  const assetImport = /import\s+(\w+)\s+from\s+(["'])([^"']+\.(?:png|jpe?g|webp|mp4|glb|woff2|wasm)(?:\?url)?|three\/[^"']+\?url)\2\s*;?/g;
  const matches = [...code.matchAll(assetImport)];
  for (const match of matches) {
    const specifier = match[3].replace(/\?url$/, '');
    const file = specifier.startsWith('.') ? path.resolve(path.dirname(source), specifier) : path.join(root, 'node_modules', specifier);
    const assetPath = specifier.startsWith('.') ? path.relative(sources[id], file) : 'runtime/' + path.basename(file);
    const key = await copyAsset(id, file, assetPath);
    code = code.replace(match[0], `const ${match[1]} = archiveAssetUrl(${JSON.stringify(key)});`);
    usesAssetHelper = true;
  }
  if (source.endsWith('loadCharizardModel.ts')) {
    code = code.replace('const decoder = new DRACOLoader(manager).setDecoderPath({ js: decoderScript, wasm: decoderWasm }).setWorkerLimit(1)',
      "manager.setURLModifier(url => url.endsWith('draco_wasm_wrapper.js') ? decoderScript : url.endsWith('draco_decoder.wasm') ? decoderWasm : url)\n  const decoder = new DRACOLoader(manager).setDecoderPath('/event-draco/').setWorkerLimit(1)");
  }
  const dependencies = [...code.matchAll(/(?:from\s*|import\s*\(?\s*)(["'])(\.[^"']+)\1/g)];
  for (const match of dependencies) {
    const dependency = await resolveFile(path.resolve(path.dirname(source), match[2]));
    await copySource(id, path.relative(sources[id], dependency));
    if (/\.tsx?$/.test(match[2])) code = code.replaceAll(match[2], match[2].replace(/\.tsx?$/, '.js'));
  }
  if (usesAssetHelper) {
    let helperImport = path.relative(path.dirname(destination), helper).replaceAll('\\', '/');
    if (!helperImport.startsWith('.')) helperImport = './' + helperImport;
    code = `import { archiveAssetUrl } from ${JSON.stringify(helperImport)};\n` + code;
  }
  if (/\.tsx?$/.test(source)) code = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  sourceRecord.adapted = code !== original;
  await save(destination, code);
}

for (const relative of ['src/components/PokemonWinnerAnnouncement.jsx', 'src/components/PokemonTicketRuleCard.jsx', 'src/components/LanguageSelector.jsx', 'src/components/pokemon30.css', 'src/components/pokemon30Event.js']) await copySource('pokemon-30', relative);
await copyAsset('pokemon-30', path.join(sources['pokemon-30'], 'src/assets/renaiss-logo-black.png'), 'src/assets/renaiss-logo-black.png');
for (const family of ['inter', 'urbanist']) await copyAsset('pokemon-30', path.join(sources['pokemon-30'], `node_modules/@fontsource-variable/${family}/files/${family}-latin-wght-normal.woff2`), `fonts/${family}.woff2`);

const winnersSource = await readFile(path.join(sources.football, 'src/app/components/control-room/WinnersRoom.jsx'), 'utf8');
const helpers = winnersSource.slice(winnersSource.indexOf('function winnerWalletLabel'), winnersSource.indexOf('function WinnersFinalDrawControl'));
const readonlyWinners = `import { Ticket, Sparkles, ChevronDown, ShieldCheck, Download, ExternalLink, Network } from 'lucide-react';\nimport { useMemo } from 'react';\nimport { getMatchPrizeImageByMatchId } from '../../data/matchPrizeImages';\nimport { canonicalMatchId } from '../../data/matchIds';\nimport { compactAddress, formatNumber } from '../../data/ticketMath';\nimport { useCampaignCopy } from '../../i18n/useCampaignCopy';\nconst FALLBACK_ROUND_ORDER = ['round16','quarterFinal','semiFinal','final'];\nconst WINNER_ROUND_LABEL_KEYS = { round16:'winnerReveal.roundGroupRound16', quarterFinal:'winnerReveal.roundGroupQuarterFinal', semiFinal:'winnerReveal.roundGroupSemiFinal', final:'winnerReveal.roundGroupFinal' };\n` + helpers + '\nexport { buildWinnerRoundGroups, buildWinnerRoundOptions, WinnerRevealRow, WinnerOnChainProof };\n';
await copySource('football', 'src/app/components/control-room/WinnersRoom.jsx', readonlyWinners);
const controlRoomSource = await readFile(path.join(sources.football, 'src/app/components/control-room/ControlRoom.jsx'), 'utf8');
const languageSwitch = controlRoomSource.slice(controlRoomSource.indexOf('function LanguageSwitch()'), controlRoomSource.indexOf('export function ControlRoom('));
let viewMenu = controlRoomSource.slice(controlRoomSource.indexOf('function ViewMenu('), controlRoomSource.indexOf('function LanguageSwitch()'));
viewMenu = viewMenu.replace('views = commandViews', 'views');
viewMenu = viewMenu.replace(/  function handlePreload\(viewId\) \{[\s\S]*?\n  \}\n/, '');
viewMenu = viewMenu.replace('viewIcons[view.id] ?? Landmark', 'viewIcons[view.id]');
viewMenu = viewMenu.replace(/\s+on(?:PointerEnter|PointerDown|Focus)=\{\(\) => handlePreload\(view.id\)\}/g, '');
await copySource('football', 'src/app/components/control-room/ControlRoom.jsx', `import { ChevronDown, Home, Medal } from 'lucide-react';\nimport { useState } from 'react';\nimport { Magnet } from '../Magnet';\nimport { useCampaignCopy } from '../../i18n/useCampaignCopy';\nconst viewIcons = { home: Home, winners: Medal };\n${viewMenu}\n${languageSwitch}\nexport { ViewMenu, LanguageSwitch };\n`);
for (const relative of ['src/app/styles.css', 'src/app/components/SideRays/SideRays.jsx', 'src/app/data/worldCupCampaign.js']) await copySource('football', relative);
for (const relative of ['src/app/assets/hero-world-cup-clean.webp', 'src/app/assets/championship-trophy-renaiss-mark.webp', 'src/app/assets/renaiss-logo-mark.webp', 'src/app/assets/Background.web.mp4', 'src/app/assets/Background.mobile.mp4']) await copyAsset('football', path.join(sources.football, relative), relative);
await save(path.join(root, 'media/event-experience-asset-release.json'), JSON.stringify({ release: 'unpublished', prefix: 'event-experiences', assets }, null, 2) + '\n');
await save(path.join(root, 'docs/event-archive-provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(`Imported ${provenance.length} presentation source files and ${Object.keys(assets).length} runtime assets (${(Object.values(assets).reduce((n, a) => n + a.bytes, 0) / 1e6).toFixed(1)} MB).`);
