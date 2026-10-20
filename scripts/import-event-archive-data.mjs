import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const manifestPath = path.join(root, 'media/event-experience-asset-release.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const sources = { football: 'https://renaiss-worldcup.zeabur.app', pokemon: 'https://renaiss30th.zeabur.app' };
async function read(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}
async function save(name, payload) {
  const destination = path.join(root, 'src/event-archives/data', name + '.json');
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(payload, null, 2) + '\n');
}
async function archiveLedger(event, url, name, expectedHash) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error('Published ledger unavailable: ' + url);
  const bytes = Buffer.from(await response.arrayBuffer());
  const text = bytes.toString('utf8');
  const payload = JSON.parse(text);
  if (/"(?:email|accessToken|refreshToken|privateKey)"\s*:/i.test(text)) throw new Error('Unexpected account metadata in public ledger.');
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (expectedHash && hash !== expectedHash.replace(/^0x/, '')) throw new Error('Published ledger hash does not match.');
  if (!payload || typeof payload !== 'object') throw new Error('Invalid ledger.');
  const key = event + '/data/' + name + '.json';
  const destination = path.join(root, 'work/assets/event-experiences', key);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  manifest.assets[key] = { path: key, bytes: bytes.length, sha256: hash };
  return key;
}
const [pokemon, football] = await Promise.all([read(sources.pokemon + '/api/pokemon30/winners'), read(sources.football + '/api/draw-winners')]);
if (!pokemon.publishedAt || football.sourceStatus !== 'revealed' || football.networkKey !== 'mainnet') throw new Error('Only published mainnet results may be archived.');
// These are the same public X avatars already shown in the original announcement.
// Copy bytes so the archive does not depend on profile hosts remaining available.
const avatarAssets = new Map();
for (const row of football.roundSnapshots.flatMap(round => round.winners)) {
  const url = row.profile.avatarUrl || row.profile.picture;
  if (!url || avatarAssets.has(url)) continue;
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'pbs.twimg.com') throw new Error('Review the new public avatar origin before importing.');
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (response.status === 404) {
    console.warn(`Original public avatar is gone for ${row.matchId}; retain the original initial badge.`);
    avatarAssets.set(url, null);
    continue;
  }
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  const extension = extensions[response.headers.get('content-type')?.split(';')[0]];
  if (!response.ok || !extension) throw new Error('Published winner avatar could not be archived.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 5_000_000) throw new Error('Public avatar exceeds the archive size limit.');
  const hash = createHash('sha256').update(bytes).digest('hex');
  const key = 'football/avatars/' + hash.slice(0, 16) + '.' + extension;
  const destination = path.join(root, 'work/assets/event-experiences', key);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  manifest.assets[key] = { path: key, bytes: bytes.length, sha256: hash };
  avatarAssets.set(url, key);
}
const publicIdentity = w => ({ displayName: w.displayName, ...(w.xHandle ? { xHandle: w.xHandle } : {}), walletAddressMasked: w.walletAddressMasked, ticketNumber: w.ticketNumber, transactionHash: w.transactionHash });
const pokemonLedger = await archiveLedger('pokemon-30', new URL(pokemon.ledger.downloadUrl, sources.pokemon).href, 'ticket-ledger', pokemon.ledger.ledgerHash);
await save('pokemon-30', {
  sourceUrl: sources.pokemon + '/api/pokemon30/winners', capturedAt: new Date().toISOString(),
  announcement: { publishedAt: pokemon.publishedAt, ledger: { ...pokemon.ledger, downloadAsset: pokemonLedger },
    winners: pokemon.winners.map(w => ({ ...publicIdentity(w), prizeSlotIndex: w.prizeSlotIndex, prize: w.prize })),
    extraWinners: pokemon.extraWinners.map(w => ({ ...publicIdentity(w), extraPrizeIndex: w.extraPrizeIndex })) },
});
const winner = w => ({ id: `${w.roundId}-${w.matchId}-${w.prizeSlotIndex}`, role: 'winner', roundId: w.roundId, matchId: w.matchId, prizeSlotIndex: w.prizeSlotIndex,
  ticketNumber: String(w.ticketNumber), walletAddress: w.walletAddress.slice(0, 6) + '…' + w.walletAddress.slice(-4), transactionHash: w.transactionHash,
  profile: { displayName: w.profile.displayName, twitterUsername: w.profile.twitterUsername,
    ...(w.profile.avatarUrl || w.profile.picture ? (avatarAssets.get(w.profile.avatarUrl || w.profile.picture)
      ? {avatarAsset: avatarAssets.get(w.profile.avatarUrl || w.profile.picture)}
      : {avatarStatus: 'source-http-404'}) : {}) } });
const transaction = tx => ({ step: tx.step, hash: tx.hash, transactionHash: tx.transactionHash, matchIds: tx.matchIds });
const snapshots = [];
for (const round of football.roundSnapshots) {
  const ledgerAsset = await archiveLedger('football', new URL(round.proof.ledgerDownloadUrl, sources.football).href, 'ledger-' + round.roundId);
  snapshots.push({ roundId: round.roundId, drawRoundId: round.drawRoundId, sourceRoundId: round.sourceRoundId,
    ledgerHash: round.ledgerHash, roundKey: round.roundKey, chainId: round.chainId, contract: round.contract,
    winners: round.winners.map(winner), ledgerAsset,
    proof: { ledgerDownloadAvailable: true, ledgerDownloadUrl: '', roundTransactions: round.proof.roundTransactions.map(transaction), transactions: round.proof.transactions.map(transaction),
      matchTransactions: round.proof.matchTransactions.map(tx => ({ matchId: tx.matchId, step: tx.step, hash: tx.hash, transactionHash: tx.transactionHash })) },
    draws: round.draws.map(draw => ({ matchId: draw.matchId, roundId: draw.roundId, drawRoundId: draw.drawRoundId, ledgerHash: draw.ledgerHash,
      totalTickets: draw.totalTickets, prizeSlotCount: draw.prizeSlotCount, winners: draw.prizeSlots.map(slot => winner(slot.winner)) })),
  });
}
const winners = snapshots.flatMap(round => round.winners);
if (winners.length !== 15 || pokemon.winners.length + pokemon.extraWinners.length !== 33) throw new Error('Unexpected public winner count. Review announcement before importing.');
await save('football', { sourceUrl: sources.football + '/api/draw-winners', capturedAt: new Date().toISOString(), sourceStatus: 'revealed', generatedAt: football.generatedAt,
  winners, roundSnapshots: snapshots });
await save('summary', { football: winners.length, 'pokemon-30': pokemon.winners.length + pokemon.extraWinners.length });
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('Archived 48 published winner records and five original public ledgers; no account APIs or profile contact details copied.');
