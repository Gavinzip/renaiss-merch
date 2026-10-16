import { keccak256, toUtf8Bytes } from 'ethers';
import { surfCampaign } from '../../shared/surf-campaign.js';
import { createParticipationStore, publicParticipant, TICKET_RULE_VERSION } from '../missions/participation-store.mjs';
import { ensureSurfContactTables, readSurfWinnerContacts } from './winner-contacts.mjs';

export const SURF_DRAW_ADDRESS = '0x78b79dB5726700BeDb18BC05aA612b11E33B00A9';
export const SURF_DRAW_RUNTIME_HASH = '0xcae9a3ae4f2c228b4fba26e00e4a9d3b79b357e3ac295f2b7139ff76d3013261';
export const SURF_DRAW_CHAIN_ID = 56;
export const SURF_DRAW_ID = keccak256(toUtf8Bytes('RENAISS_SURF_V1_MAIN_ROUND_1'));
export const SURF_DRAW_RETRY_ID = keccak256(toUtf8Bytes('RENAISS_SURF_V1_MAIN_ROUND_2'));
export const SURF_DRAW_PRIZES = Object.freeze([
  ...Array.from({ length: surfCampaign.plannedRewards.mysteryBoxes }, (_, index) => ({ slot: index, kind: 'mystery-box', number: index + 1 })),
  ...Array.from({ length: surfCampaign.plannedRewards.proMonthTrials }, (_, index) => ({ slot: surfCampaign.plannedRewards.mysteryBoxes + index, kind: 'surf-pro-month', number: index + 1 })),
]);

const WALLET = /^0x[a-fA-F0-9]{40}$/;

export function ensureSurfDrawTables(db) {
  createParticipationStore(db);
  ensureSurfContactTables(db);
  db.exec(`CREATE TABLE IF NOT EXISTS surf_draw_snapshots (
    draw_id TEXT PRIMARY KEY, ledger_hash TEXT NOT NULL, ticket_count INTEGER NOT NULL,
    participant_count INTEGER NOT NULL, canonical_json TEXT NOT NULL,
    prepared_at TEXT NOT NULL, prepared_by TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS surf_draw_transactions (
    action_key TEXT PRIMARY KEY, draw_id TEXT NOT NULL, action TEXT NOT NULL,
    tx_hash TEXT NOT NULL UNIQUE, signed_raw TEXT NOT NULL,
    created_at TEXT NOT NULL, confirmed_at TEXT, receipt_status INTEGER,
    broadcast_state TEXT NOT NULL DEFAULT 'signed', last_broadcast_at TEXT
  );
  CREATE TABLE IF NOT EXISTS surf_draw_action_locks (
    draw_id TEXT PRIMARY KEY, action_key TEXT NOT NULL,
    lock_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS surf_draw_active_round (
    id INTEGER PRIMARY KEY CHECK(id=1), draw_id TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS surf_draw_superseded_rounds (
    draw_id TEXT PRIMARY KEY, successor_draw_id TEXT NOT NULL UNIQUE,
    request_id TEXT NOT NULL, request_tx_hash TEXT NOT NULL, request_block INTEGER NOT NULL,
    old_ledger_hash TEXT NOT NULL, new_ledger_hash TEXT NOT NULL,
    observed_block INTEGER NOT NULL, superseded_at TEXT NOT NULL, reason TEXT NOT NULL
  );`);
  db.prepare('INSERT OR IGNORE INTO surf_draw_active_round(id,draw_id,updated_at) VALUES(1,?,?)')
    .run(SURF_DRAW_ID, new Date().toISOString());
  if (!db.pragma('table_info(surf_draw_transactions)').some((column) => column.name === 'broadcast_state')) {
    db.exec("ALTER TABLE surf_draw_transactions ADD COLUMN broadcast_state TEXT NOT NULL DEFAULT 'signed'");
  }
  if (!db.pragma('table_info(surf_draw_transactions)').some((column) => column.name === 'last_broadcast_at')) {
    db.exec('ALTER TABLE surf_draw_transactions ADD COLUMN last_broadcast_at TEXT');
  }
}

export function activeSurfDrawId(db) {
  ensureSurfDrawTables(db);
  const id = db.prepare('SELECT draw_id FROM surf_draw_active_round WHERE id=1').get()?.draw_id;
  if (id !== SURF_DRAW_ID && id !== SURF_DRAW_RETRY_ID) throw new Error('Unknown active Surf draw round');
  return id;
}

export function readSnapshot(db, drawId = activeSurfDrawId(db)) {
  ensureSurfDrawTables(db);
  const record = db.prepare('SELECT * FROM surf_draw_snapshots WHERE draw_id=?').get(drawId);
  if (!record) return null;
  const canonical = JSON.parse(record.canonical_json);
  const validPrizes = Array.isArray(canonical.prizes) &&
    JSON.stringify(canonical.prizes) === JSON.stringify(SURF_DRAW_PRIZES);
  const validEntries = Array.isArray(canonical.entries) &&
    canonical.entries.length === record.participant_count &&
    canonical.entries.reduce((next, entry) => {
      if (!Number.isInteger(entry.start) || !Number.isInteger(entry.end) ||
          entry.start !== next || entry.end - entry.start + 1 !== entry.ticketCount ||
          entry.ticketCount < 1 || entry.ticketCount > 3) return NaN;
      return entry.end + 1;
    }, 1) === record.ticket_count + 1;
  if (keccak256(toUtf8Bytes(record.canonical_json)) !== record.ledger_hash ||
      canonical.drawId !== drawId || canonical.campaignId !== surfCampaign.id ||
      canonical.ruleVersion !== TICKET_RULE_VERSION ||
      canonical.rules?.oneWinPerTicket !== true ||
      canonical.rules?.repeatPersonWithDifferentTickets !== true ||
      canonical.rules?.alternatesPerPrize !== 0 || !validPrizes || !validEntries) {
    throw new Error('Surf draw snapshot integrity failed');
  }
  return { ...record, canonical, contacts: readSurfWinnerContacts(db, record) };
}

export function buildCandidateLedger(db, drawId = activeSurfDrawId(db)) {
  ensureSurfDrawTables(db);
  const rows = db.prepare(`SELECT * FROM mission_participants WHERE campaign=? AND rule_version=? AND ticket_count>0 ORDER BY user_sub`)
    .all(surfCampaign.id, TICKET_RULE_VERSION).map(publicParticipant);
  const wallets = new Set(), emails = new Set();
  let nextTicket = 1;
  const entries = rows.map((row) => {
    if (row.status !== 'eligible' || !WALLET.test(row.walletAddress || '') || !row.tasks?.accounts?.verified ||
        !Number.isInteger(row.ticketCount) || row.ticketCount < 1 || row.ticketCount > 3 ||
        row.ticketCount !== 1 + Number(Boolean(row.tasks.x?.verified)) + Number(Boolean(row.tasks.discord?.verified))) {
      throw new Error(`Participant ${row.userSub} has inconsistent eligibility or tickets`);
    }
    const wallet = row.walletAddress.toLowerCase(), email = row.email?.trim().toLowerCase();
    if (wallets.has(wallet)) throw new Error('Surf draw contains a duplicate wallet');
    // Eligibility is decided by the recorded tasks and wallet. Some verified
    // Renaiss accounts have no email, so keep their tickets in the ledger and
    // use the SSO subject or wallet to arrange private prize fulfillment.
    if (email && emails.has(email)) throw new Error('Surf draw contains a duplicate email');
    wallets.add(wallet);
    if (email) emails.add(email);
    const entry = {
      start: nextTicket, end: nextTicket + row.ticketCount - 1,
      userSub: row.userSub, name: row.name || '', walletAddress: row.walletAddress,
      email: row.email, ticketCount: row.ticketCount,
    };
    nextTicket = entry.end + 1;
    return entry;
  });
  const canonical = {
    version: 'surf-draw-ledger-v1', campaignId: surfCampaign.id,
    ruleVersion: TICKET_RULE_VERSION, drawId,
    rules: { oneWinPerTicket: true, repeatPersonWithDifferentTickets: true, alternatesPerPrize: 0 },
    prizes: SURF_DRAW_PRIZES, entries,
  };
  const canonicalJson = JSON.stringify(canonical);
  return { canonical, canonicalJson, ledgerHash: keccak256(toUtf8Bytes(canonicalJson)),
    ticketCount: nextTicket - 1, participantCount: entries.length };
}

export function findWinner(snapshot, ticketNumber) {
  const number = Number(ticketNumber);
  return snapshot?.canonical.entries.find((entry) => entry.start <= number && number <= entry.end) || null;
}
