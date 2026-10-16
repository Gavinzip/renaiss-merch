import { getPublicOrigin } from '../config.mjs';
import { HttpError, sendJson } from '../http.mjs';
import { getMerchDatabase } from '../merch-database.mjs';
import { getRuntimeConfig } from '../runtime-config.mjs';
import { readJsonBody } from '../shipping-details.mjs';
import { buildCandidateLedger, ensureSurfDrawTables, readSnapshot, SURF_DRAW_ID, SURF_DRAW_PRIZES } from './model.mjs';
import { publicChainState, readSurfChain } from './chain.mjs';
import { publicSurfWinner } from './public-winner.mjs';
import { validateSurfRevealSelection } from './reveal-selection.mjs';
import { requireSurfDrawAccess, surfDrawOperatorSession } from './access.mjs';

import { sendSurfDrawAction, reconcileSurfTransactions } from './transactions.mjs';
import { assertSurfRevision, surfRevision } from './lifecycle.mjs';
import { readSurfOperatorSession } from './operator-routes.mjs';
import { handleSurfReset } from './reset.mjs';
import { captureSurfWinnerContacts } from './winner-contacts.mjs';

const ROOT = '/api/admin/missions/surf/draw';
const PUBLIC_ROOT = '/api/missions/surf/draw';
const ACTIONS = new Set(['prepare', 'finalize', 'request', 'reveal', 'reset']);
const ACTION_LOCK_LEASE_MS = 120_000;


export function createSurfDrawHandler({ readSession }) {
  return async function handle(req, res, url) {
    if (url.pathname === PUBLIC_ROOT) {
      if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
      requireSurfDrawAccess(req);
      const db = getMerchDatabase(getRuntimeConfig().databasePath);
      ensureSurfDrawTables(db);
      const snapshot = readSnapshot(db);
      const myTickets = ticketRangeForSession(snapshot, readSession(req));
      let chain = null, chainError = null;
      try {
        const live = await readSurfChain(snapshot, { includeSigner: false });
        const publicChain = publicChainState(live);
        chain = { ...publicChain, signerAddress: null, signerAdmin: null,
          winners: publicChain.winners.map(publicSurfWinner) };
        live.provider.destroy();
      } catch (error) { chainError = safeChainError(error); }
      sendJson(res, 200, { drawId: SURF_DRAW_ID, prizes: SURF_DRAW_PRIZES,
        closedAt: readClosedAt(), revision: surfRevision(db), actionsEnabled: false, candidate: null,
        snapshot: snapshot ? { preparedAt: snapshot.prepared_at, participants: snapshot.participant_count,
          tickets: snapshot.ticket_count, ledgerHash: snapshot.ledger_hash } : null,
        chain, chainError, transactions: [], myTickets });
      return true;
    }
    if (url.pathname !== ROOT && !url.pathname.startsWith(`${ROOT}/`)) return false;
    const action = url.pathname === ROOT ? null : url.pathname.slice(ROOT.length + 1);
    if (action && !ACTIONS.has(action)) throw new HttpError(404, 'not_found');
    if (action === 'reset' ? !['GET', 'POST'].includes(req.method) : req.method !== (action ? 'POST' : 'GET')) throw new HttpError(405, 'method_not_allowed');
    const delegated = readSurfOperatorSession(req);
    if (action === 'reset' && !delegated) throw new HttpError(403, 'operator_connection_required');
    const session = delegated || surfDrawOperatorSession(requireSurfDrawAccess(req));
    if (req.method === 'POST' && req.headers.origin !== getPublicOrigin(req)) throw new HttpError(403, 'invalid_request_origin');
    const db = getMerchDatabase(getRuntimeConfig().databasePath);
    ensureSurfDrawTables(db);
    if (action === 'reset') return handleSurfReset(req, res);
    if (!action) {
      const revisionBeforeRead = surfRevision(db);
      const snapshot = readSnapshot(db);
      const myTickets = ticketRangeForSession(snapshot, session);
      const candidate = snapshot ? null : buildCandidateLedger(db);
      let chain = null, chainError = null;
      try {
        const live = await readSurfChain(snapshot);
        await reconcileSurfTransactions(db, live.provider);
        if (surfRevision(db) !== revisionBeforeRead) { live.provider.destroy(); return handle(req, res, url); }
        chain = publicChainState(live);
        live.provider.destroy();
      }
      catch (error) { chainError = safeChainError(error); }
      const transactions = db.prepare('SELECT action,tx_hash AS txHash,created_at AS createdAt,confirmed_at AS confirmedAt,receipt_status AS receiptStatus,broadcast_state AS broadcastState FROM surf_draw_transactions WHERE draw_id=? ORDER BY created_at DESC LIMIT 35').all(SURF_DRAW_ID);
      const locked = db.prepare('SELECT action_key AS actionKey,created_at AS createdAt FROM surf_draw_action_locks WHERE draw_id=?').get(SURF_DRAW_ID);
      const actionLock = locked ? { ...locked, recoverable: Date.now() - Date.parse(locked.createdAt) >= ACTION_LOCK_LEASE_MS } : null;
      sendJson(res, 200, { drawId: SURF_DRAW_ID, prizes: SURF_DRAW_PRIZES, closedAt: readClosedAt(),
        revision: surfRevision(db), actionsEnabled: process.env.SURF_DRAW_ENABLED === 'true',
        candidate: candidate ? { participants: candidate.participantCount, tickets: candidate.ticketCount,
          ledgerHash: candidate.ledgerHash } : null,
        snapshot: snapshot ? { preparedAt: snapshot.prepared_at, participants: snapshot.participant_count,
          tickets: snapshot.ticket_count, ledgerHash: snapshot.ledger_hash } : null,
        chain, chainError, transactions, actionLock, myTickets });
      return true;
    }
    assertActionsEnabled();
    const body = await readJsonBody(req);
    assertSurfRevision(db, body.expectedRevision);
    if (body.drawId !== SURF_DRAW_ID) throw new HttpError(409, 'draw_id_changed');
    if (action === 'prepare') {
      const chain = await readSurfChain(null);
      chain.provider.destroy();
      if (chain.state !== 0) throw new HttpError(409, 'draw_already_started');
      const candidate = buildCandidateLedger(db);
      if (candidate.ticketCount < SURF_DRAW_PRIZES.length) throw new HttpError(409, 'not_enough_tickets');
      if (body.ledgerHash !== candidate.ledgerHash) throw new HttpError(409, 'participant_ledger_changed');
      db.transaction(() => {
        assertSurfRevision(db, body.expectedRevision);
        if (readSnapshot(db)) throw new HttpError(409, 'snapshot_already_prepared');
        const preparedAt = new Date().toISOString();
        captureSurfWinnerContacts(db, candidate, preparedAt);
        db.prepare('INSERT INTO surf_draw_snapshots VALUES(?,?,?,?,?,?,?)').run(
          SURF_DRAW_ID, candidate.ledgerHash, candidate.ticketCount, candidate.participantCount,
          candidate.canonicalJson, preparedAt, session.user.sub,
        );
      }).immediate();
      sendJson(res, 200, { prepared: true, ledgerHash: candidate.ledgerHash });
      return true;
    }
    const snapshot = readSnapshot(db);
    if (!snapshot || body.ledgerHash !== snapshot.ledger_hash) throw new HttpError(409, 'locked_ledger_mismatch');
    const chain = await readSurfChain(snapshot);
    try {
      if (!chain.results.ready) throw new HttpError(409, 'draw_results_not_configured');
      if (!chain.signer || !chain.signerAdmin) throw new HttpError(403, 'draw_signer_not_authorized');
      if (!chain.vrf.subscription?.consumerRegistered) throw new HttpError(409, 'vrf_consumer_not_registered');
      if (action === 'finalize') {
        if (chain.state !== 0) throw new HttpError(409, 'draw_not_draft');
        return await sendSurfDrawAction(res, db, chain, 'finalize', () => chain.contract.finalizeLedger.populateTransaction(
          SURF_DRAW_ID, snapshot.ledger_hash, snapshot.ticket_count, SURF_DRAW_PRIZES.length, ''), body.expectedRevision,
        );
      }
      if (!chain.ledgerMatch) throw new HttpError(409, 'onchain_ledger_mismatch');
      if (action === 'request') {
        if (chain.state !== 1) throw new HttpError(409, 'draw_not_finalized');
        if (chain.vrf.subscription.pendingRequest || BigInt(chain.vrf.subscription.balanceWei) === 0n) {
          throw new HttpError(409, 'vrf_subscription_not_ready');
        }
        return await sendSurfDrawAction(res, db, chain, 'request', () => chain.contract.requestDraw.populateTransaction(SURF_DRAW_ID), body.expectedRevision);
      }
      if (chain.state !== 3) throw new HttpError(409, 'randomness_not_ready');
      const slots = validateSurfRevealSelection(body, chain, SURF_DRAW_PRIZES);
      return await sendSurfDrawAction(res, db, chain, `reveal:${slots.join(',')}`, () => chain.resultsContract.revealPrizeSlots.populateTransaction(
        SURF_DRAW_ID, chain.requestId, snapshot.ledger_hash, slots), body.expectedRevision);
    } finally { chain.provider.destroy(); }
  };
}

function readClosedAt() {
  const value = process.env.SURF_DRAW_CLOSED_AT?.trim();
  return value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value)) ? value : null;
}

function ticketRangeForSession(snapshot, session) {
  if (!snapshot || !session?.user?.sub || session.user.isDemo) return null;
  const entry = snapshot.canonical.entries.find((participant) => participant.userSub === session.user.sub);
  return entry ? { start: entry.start, end: entry.end } : null;
}

function assertActionsEnabled() {
  const closedAt = readClosedAt();
  if (process.env.SURF_DRAW_ENABLED !== 'true' || !closedAt || Date.now() < Date.parse(closedAt)) {
    throw new HttpError(409, 'surf_draw_not_released');
  }
}

function safeChainError(error) {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('SURF_DRAW_RPC_URL') || message.startsWith('Wrong chain:') ||
      message.startsWith('Canonical Surf draw') || message.startsWith('On-chain winners') ||
      message.startsWith('Surf draw snapshot') || message.startsWith('Surf draw results')) return message;
  const code = typeof error?.code === 'string' ? error.code.replace(/[^A-Z0-9_]/gi, '').slice(0, 40) : 'unknown';
  return `鏈上讀取失敗（${code}）；請檢查 Surf RPC、合約與網路狀態。`;
}
