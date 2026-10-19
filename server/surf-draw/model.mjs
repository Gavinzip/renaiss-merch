import { keccak256, toUtf8Bytes } from 'ethers';
import { surfCampaign } from '../../shared/surf-campaign.js';
import { createParticipationStore, publicParticipant, TICKET_RULE_VERSION } from '../missions/participation-store.mjs';
import { ensureSurfContactTables, readSurfWinnerContacts } from './winner-contacts.mjs';
export const SURF_DRAW_ADDRESS = '0x78b79dB5726700BeDb18BC05aA612b11E33B00A9';
export const SURF_DRAW_RUNTIME_HASH = '0xcae9a3ae4f2c228b4fba26e00e4a9d3b79b357e3ac295f2b7139ff76d3013261';
export const SURF_DRAW_CHAIN_ID = 56;
export const SURF_DRAW_ID = keccak256(toUtf8Bytes('RENAISS_SURF_V1_MAIN_ROUND_1'));
export const SURF_DRAW_RETRY_ID = keccak256(toUtf8Bytes('RENAISS_SURF_V1_MAIN_ROUND_2'));
export const SURF_CHAINLINK_DRAW_ID = keccak256(toUtf8Bytes('RENAISS_SURF_V1_CHAINLINK_ROUND_3'));
export const SURF_CHAINLINK_REDRAW_ID = keccak256(toUtf8Bytes('RENAISS_SURF_V1_CHAINLINK_REDRAW_ROUND_4'));
export const SURF_DRAW_PRIZES = Object.freeze([...Array.from({
  length: surfCampaign.plannedRewards.mysteryBoxes
}, (_, index) => ({
  slot: index,
  kind: 'mystery-box',
  number: index + 1
})), ...Array.from({
  length: surfCampaign.plannedRewards.proMonthTrials
}, (_, index) => ({
  slot: surfCampaign.plannedRewards.mysteryBoxes + index,
  kind: 'surf-pro-month',
  number: index + 1
}))]);
const WALLET = /^0x[a-fA-F0-9]{40}$/;
export async function ensureSurfDrawTables(db) {
  createParticipationStore(db);
  ensureSurfContactTables(db);
  await db.prepare('INSERT INTO surf_draw_active_round(id,draw_id,updated_at) VALUES(1,?,?) ON CONFLICT DO NOTHING').run(SURF_DRAW_ID, new Date().toISOString());
}
export async function activeSurfDrawId(db) {
  await ensureSurfDrawTables(db);
  const id = (await db.prepare('SELECT draw_id FROM surf_draw_active_round WHERE id=1').get())?.draw_id;
  if (id !== SURF_DRAW_ID && id !== SURF_DRAW_RETRY_ID && id !== SURF_CHAINLINK_DRAW_ID && id !== SURF_CHAINLINK_REDRAW_ID) throw new Error('Unknown active Surf draw round');
  return id;
}
export async function readSnapshot(db, drawId = null) {
  drawId ??= await activeSurfDrawId(db);
  await ensureSurfDrawTables(db);
  const record = await db.prepare('SELECT * FROM surf_draw_snapshots WHERE draw_id=?').get(drawId);
  if (!record) return null;
  const canonical = JSON.parse(record.canonical_json);
  const validPrizes = Array.isArray(canonical.prizes) && JSON.stringify(canonical.prizes) === JSON.stringify(SURF_DRAW_PRIZES);
  const validEntries = Array.isArray(canonical.entries) && canonical.entries.length === record.participant_count && canonical.entries.reduce((next, entry) => {
    if (!Number.isInteger(entry.start) || !Number.isInteger(entry.end) || entry.start !== next || entry.end - entry.start + 1 !== entry.ticketCount || entry.ticketCount < 1 || entry.ticketCount > 3) return NaN;
    return entry.end + 1;
  }, 1) === record.ticket_count + 1;
  if (keccak256(toUtf8Bytes(record.canonical_json)) !== record.ledger_hash || canonical.drawId !== drawId || canonical.campaignId !== surfCampaign.id || canonical.ruleVersion !== TICKET_RULE_VERSION || canonical.rules?.oneWinPerTicket !== true || canonical.rules?.repeatPersonWithDifferentTickets !== true || canonical.rules?.alternatesPerPrize !== 0 || !validPrizes || !validEntries) {
    throw new Error('Surf draw snapshot integrity failed');
  }
  return {
    ...record,
    canonical,
    contacts: await readSurfWinnerContacts(db, record)
  };
}
export async function buildCandidateLedger(db, drawId = null) {
  drawId ??= await activeSurfDrawId(db);
  await ensureSurfDrawTables(db);
  const rows = (await db.prepare(`SELECT * FROM mission_participants WHERE campaign=? AND rule_version=? AND ticket_count>0 ORDER BY user_sub`).all(surfCampaign.id, TICKET_RULE_VERSION)).map(publicParticipant);
  const wallets = new Set(),
    emails = new Set();
  let nextTicket = 1;
  const entries = rows.map(row => {
    if (row.status !== 'eligible' || !WALLET.test(row.walletAddress || '') || !row.tasks?.accounts?.verified || !Number.isInteger(row.ticketCount) || row.ticketCount < 1 || row.ticketCount > 3 || row.ticketCount !== 1 + Number(Boolean(row.tasks.x?.verified)) + Number(Boolean(row.tasks.discord?.verified))) {
      throw new Error(`Participant ${row.userSub} has inconsistent eligibility or tickets`);
    }
    const wallet = row.walletAddress.toLowerCase(),
      email = row.email?.trim().toLowerCase();
    if (wallets.has(wallet)) throw new Error('Surf draw contains a duplicate wallet');
    // Eligibility is decided by the recorded tasks and wallet. Some verified
    // Renaiss accounts have no email, so keep their tickets in the ledger and
    // use the SSO subject or wallet to arrange private prize fulfillment.
    if (email && emails.has(email)) throw new Error('Surf draw contains a duplicate email');
    wallets.add(wallet);
    if (email) emails.add(email);
    const entry = {
      start: nextTicket,
      end: nextTicket + row.ticketCount - 1,
      userSub: row.userSub,
      name: row.name || '',
      walletAddress: row.walletAddress,
      email: row.email,
      ticketCount: row.ticketCount
    };
    nextTicket = entry.end + 1;
    return entry;
  });
  const canonical = {
    version: 'surf-draw-ledger-v1',
    campaignId: surfCampaign.id,
    ruleVersion: TICKET_RULE_VERSION,
    drawId,
    rules: {
      oneWinPerTicket: true,
      repeatPersonWithDifferentTickets: true,
      alternatesPerPrize: 0
    },
    prizes: SURF_DRAW_PRIZES,
    entries
  };
  const canonicalJson = JSON.stringify(canonical);
  return {
    canonical,
    canonicalJson,
    ledgerHash: keccak256(toUtf8Bytes(canonicalJson)),
    ticketCount: nextTicket - 1,
    participantCount: entries.length
  };
}
export function findWinner(snapshot, ticketNumber) {
  const number = Number(ticketNumber);
  return snapshot?.canonical.entries.find(entry => entry.start <= number && number <= entry.end) || null;
}
