import { randomUUID } from 'node:crypto';
import { keccak256 } from 'ethers';
import { getPublicOrigin } from '../config.mjs';
import { requireFulfillmentAdministrator } from '../fulfillment-admin.mjs';
import { HttpError, sendJson } from '../http.mjs';
import { getMerchDatabase } from '../merch-database.mjs';
import { getRuntimeConfig } from '../runtime-config.mjs';
import { readJsonBody } from '../shipping-details.mjs';
import { buildCandidateLedger, ensureSurfDrawTables, readSnapshot, SURF_DRAW_ID, SURF_DRAW_PRIZES } from './model.mjs';
import { publicChainState, readSurfChain } from './chain.mjs';
import { publicSurfWinner } from './public-winner.mjs';
import { validateSurfRevealSelection } from './reveal-selection.mjs';
import { requireSurfDrawAccess } from './access.mjs';

const ROOT = '/api/admin/missions/surf/draw';
const PUBLIC_ROOT = '/api/missions/surf/draw';
const ACTIONS = new Set(['prepare', 'finalize', 'request', 'reveal']);
const ACTION_LOCK_LEASE_MS = 120_000;
const BROADCAST_RETRY_MS = 30_000;

export function createSurfDrawHandler({ readSession }) {
  return async (req, res, url) => {
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
      } catch (error) { chainError = safeChainError(error); }
      sendJson(res, 200, { drawId: SURF_DRAW_ID, prizes: SURF_DRAW_PRIZES,
        closedAt: readClosedAt(), actionsEnabled: false, candidate: null,
        snapshot: snapshot ? { preparedAt: snapshot.prepared_at, participants: snapshot.participant_count,
          tickets: snapshot.ticket_count, ledgerHash: snapshot.ledger_hash } : null,
        chain, chainError, transactions: [], myTickets });
      return true;
    }
    if (url.pathname !== ROOT && !url.pathname.startsWith(`${ROOT}/`)) return false;
    const action = url.pathname === ROOT ? null : url.pathname.slice(ROOT.length + 1);
    if (action && !ACTIONS.has(action)) throw new HttpError(404, 'not_found');
    if (req.method !== (action ? 'POST' : 'GET')) throw new HttpError(405, 'method_not_allowed');
    requireSurfDrawAccess(req);
    const session = readSession(req);
    requireFulfillmentAdministrator(session);
    if (session.user.isDemo) throw new HttpError(403, 'demo_missions_disabled');
    if (action && req.headers.origin !== getPublicOrigin(req)) throw new HttpError(403, 'invalid_request_origin');
    const db = getMerchDatabase(getRuntimeConfig().databasePath);
    ensureSurfDrawTables(db);
    if (!action) {
      const snapshot = readSnapshot(db);
      const myTickets = ticketRangeForSession(snapshot, session);
      const candidate = snapshot ? null : buildCandidateLedger(db);
      let chain = null, chainError = null;
      try {
        const live = await readSurfChain(snapshot);
        await reconcileTransactions(db, live.provider);
        chain = publicChainState(live);
      }
      catch (error) { chainError = safeChainError(error); }
      const transactions = db.prepare('SELECT action,tx_hash AS txHash,created_at AS createdAt,confirmed_at AS confirmedAt,receipt_status AS receiptStatus,broadcast_state AS broadcastState FROM surf_draw_transactions WHERE draw_id=? ORDER BY created_at DESC LIMIT 35').all(SURF_DRAW_ID);
      const locked = db.prepare('SELECT action_key AS actionKey,created_at AS createdAt FROM surf_draw_action_locks WHERE draw_id=?').get(SURF_DRAW_ID);
      const actionLock = locked ? { ...locked, recoverable: Date.now() - Date.parse(locked.createdAt) >= ACTION_LOCK_LEASE_MS } : null;
      sendJson(res, 200, { drawId: SURF_DRAW_ID, prizes: SURF_DRAW_PRIZES, closedAt: readClosedAt(),
        actionsEnabled: process.env.SURF_DRAW_ENABLED === 'true',
        candidate: candidate ? { participants: candidate.participantCount, tickets: candidate.ticketCount,
          ledgerHash: candidate.ledgerHash } : null,
        snapshot: snapshot ? { preparedAt: snapshot.prepared_at, participants: snapshot.participant_count,
          tickets: snapshot.ticket_count, ledgerHash: snapshot.ledger_hash } : null,
        chain, chainError, transactions, actionLock, myTickets });
      return true;
    }
    assertActionsEnabled();
    const body = await readJsonBody(req);
    if (body.drawId !== SURF_DRAW_ID) throw new HttpError(409, 'draw_id_changed');
    if (action === 'prepare') {
      const chain = await readSurfChain(null);
      if (chain.state !== 0) throw new HttpError(409, 'draw_already_started');
      const candidate = buildCandidateLedger(db);
      if (candidate.ticketCount < SURF_DRAW_PRIZES.length) throw new HttpError(409, 'not_enough_tickets');
      if (body.ledgerHash !== candidate.ledgerHash) throw new HttpError(409, 'participant_ledger_changed');
      db.transaction(() => {
        if (readSnapshot(db)) throw new HttpError(409, 'snapshot_already_prepared');
        db.prepare('INSERT INTO surf_draw_snapshots VALUES(?,?,?,?,?,?,?)').run(
          SURF_DRAW_ID, candidate.ledgerHash, candidate.ticketCount, candidate.participantCount,
          candidate.canonicalJson, new Date().toISOString(), session.user.sub,
        );
      }).immediate();
      sendJson(res, 200, { prepared: true, ledgerHash: candidate.ledgerHash });
      return true;
    }
    const snapshot = readSnapshot(db);
    if (!snapshot || body.ledgerHash !== snapshot.ledger_hash) throw new HttpError(409, 'locked_ledger_mismatch');
    const chain = await readSurfChain(snapshot);
    if (!chain.signer || !chain.signerAdmin) throw new HttpError(403, 'draw_signer_not_authorized');
    if (!chain.vrf.subscription?.consumerRegistered) throw new HttpError(409, 'vrf_consumer_not_registered');
    if (action === 'finalize') {
      if (chain.state !== 0) throw new HttpError(409, 'draw_not_draft');
      return sendAction(res, db, chain, 'finalize', () => chain.contract.finalizeLedger.populateTransaction(
        SURF_DRAW_ID, snapshot.ledger_hash, snapshot.ticket_count, SURF_DRAW_PRIZES.length, ''),
      );
    }
    if (!chain.ledgerMatch) throw new HttpError(409, 'onchain_ledger_mismatch');
    if (action === 'request') {
      if (chain.state !== 1) throw new HttpError(409, 'draw_not_finalized');
      if (chain.vrf.subscription.pendingRequest || BigInt(chain.vrf.subscription.balanceWei) === 0n) {
        throw new HttpError(409, 'vrf_subscription_not_ready');
      }
      return sendAction(res, db, chain, 'request', () => chain.contract.requestDraw.populateTransaction(SURF_DRAW_ID));
    }
    if (chain.state !== 3) throw new HttpError(409, 'randomness_not_ready');
    const slots = validateSurfRevealSelection(body, chain, SURF_DRAW_PRIZES);
    return sendAction(res, db, chain, `reveal:${slots.join(',')}`, () => chain.contract.drawPrizeSlots.populateTransaction(SURF_DRAW_ID, slots));
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

async function sendAction(res, db, chain, action, transactionFactory) {
  const actionKey = `${SURF_DRAW_ID}:${action}`;
  const lockId = randomUUID();
  const reservation = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM surf_draw_transactions WHERE action_key=?').get(actionKey);
    if (existing) return existing;
    if (db.prepare('SELECT 1 FROM surf_draw_transactions WHERE draw_id=? AND confirmed_at IS NULL').get(SURF_DRAW_ID)) {
      throw new HttpError(409, 'prior_action_pending');
    }
    const priorLock = db.prepare('SELECT lock_id AS lockId,created_at AS createdAt FROM surf_draw_action_locks WHERE draw_id=?').get(SURF_DRAW_ID);
    if (priorLock) {
      const age = Date.now() - Date.parse(priorLock.createdAt);
      if (!Number.isFinite(age) || age < ACTION_LOCK_LEASE_MS) throw new HttpError(409, 'prior_action_pending');
      // The expired owner may still resume. Its lock-id check below fences it
      // out before its signed transaction can be stored or broadcast.
      db.prepare('DELETE FROM surf_draw_action_locks WHERE draw_id=? AND lock_id=?').run(SURF_DRAW_ID, priorLock.lockId);
    }
    db.prepare('INSERT INTO surf_draw_action_locks (draw_id,action_key,lock_id,created_at) VALUES(?,?,?,?)')
      .run(SURF_DRAW_ID, actionKey, lockId, new Date().toISOString());
    return null;
  }).immediate();
  if (reservation) {
    if (reservation.receipt_status === 0) throw new HttpError(409, 'prior_action_failed');
    const broadcastState = reservation.confirmed_at || reservation.broadcast_state === 'accepted'
      ? reservation.broadcast_state : await broadcastSavedTransaction(db, chain.provider, reservation);
    sendJson(res, 200, { action, txHash: reservation.tx_hash, broadcastState, existing: true });
    return true;
  }
  let raw, txHash;
  try {
    // The reservation precedes every await. Its ID is checked again before
    // persistence, so an expired owner cannot publish after a new owner starts.
    const fresh = await readSurfChain(readSnapshot(db));
    if (fresh.state !== chain.state || fresh.winnerCount !== chain.winnerCount ||
        fresh.ledgerHash !== chain.ledgerHash || fresh.ledgerMatch !== chain.ledgerMatch ||
        fresh.signerAddress !== chain.signerAddress || !fresh.signerAdmin) {
      throw new HttpError(409, 'draw_state_changed');
    }
    const tx = await transactionFactory();
    const estimate = await fresh.provider.estimateGas({ ...tx, from: fresh.signer.address });
    const latest = await fresh.provider.getBlock('latest');
    const gasLimit = estimate * 120n / 100n;
    if (!latest || gasLimit >= latest.gasLimit) throw new HttpError(409, 'draw_gas_limit_exceeded');
    const fee = await fresh.provider.getFeeData();
    if (!fee.gasPrice) throw new HttpError(503, 'gas_price_unavailable');
    const nonce = await fresh.provider.getTransactionCount(fresh.signer.address, 'pending');
    raw = await fresh.signer.signTransaction({ ...tx, chainId: fresh.chainId, type: 0, gasPrice: fee.gasPrice,
      gasLimit, nonce });
    txHash = keccak256(raw);
    db.transaction(() => {
      if (!db.prepare('SELECT 1 FROM surf_draw_action_locks WHERE draw_id=? AND lock_id=?').get(SURF_DRAW_ID, lockId) ||
          db.prepare('SELECT 1 FROM surf_draw_transactions WHERE draw_id=? AND confirmed_at IS NULL').get(SURF_DRAW_ID)) {
        throw new HttpError(409, 'prior_action_pending');
      }
      db.prepare('INSERT INTO surf_draw_transactions (action_key,draw_id,action,tx_hash,signed_raw,created_at,broadcast_state) VALUES(?,?,?,?,?,?,?)').run(
        actionKey, SURF_DRAW_ID, action, txHash, raw, new Date().toISOString(), 'signed',
      );
      db.prepare('DELETE FROM surf_draw_action_locks WHERE draw_id=? AND lock_id=?').run(SURF_DRAW_ID, lockId);
    }).immediate();
  } finally {
    db.prepare('DELETE FROM surf_draw_action_locks WHERE draw_id=? AND lock_id=?').run(SURF_DRAW_ID, lockId);
  }
  const broadcastState = await broadcastSavedTransaction(db, chain.provider,
    { action_key: actionKey, tx_hash: txHash, signed_raw: raw });
  sendJson(res, 202, { action, txHash, broadcastState });
  return true;
}

async function broadcastSavedTransaction(db, provider, record) {
  db.prepare('UPDATE surf_draw_transactions SET last_broadcast_at=? WHERE action_key=?')
    .run(new Date().toISOString(), record.action_key);
  let state = 'accepted';
  try {
    const response = await provider.broadcastTransaction(record.signed_raw);
    if (response.hash.toLowerCase() !== record.tx_hash.toLowerCase()) throw new Error('Broadcast hash mismatch');
  } catch { state = 'uncertain'; }
  db.prepare("UPDATE surf_draw_transactions SET broadcast_state=CASE WHEN broadcast_state='accepted' THEN 'accepted' ELSE ? END WHERE action_key=?")
    .run(state, record.action_key);
  return db.prepare('SELECT broadcast_state FROM surf_draw_transactions WHERE action_key=?').get(record.action_key).broadcast_state;
}

async function reconcileTransactions(db, provider) {
  const pending = db.prepare('SELECT action_key,tx_hash,signed_raw,broadcast_state,last_broadcast_at FROM surf_draw_transactions WHERE draw_id=? AND confirmed_at IS NULL').all(SURF_DRAW_ID);
  for (const record of pending) {
    const receipt = await provider.getTransactionReceipt(record.tx_hash);
    if (receipt) db.prepare('UPDATE surf_draw_transactions SET confirmed_at=?,receipt_status=? WHERE action_key=?')
      .run(new Date().toISOString(), receipt.status, record.action_key);
    else if (record.broadcast_state === 'signed' || record.broadcast_state === 'uncertain') {
      const lastAttempt = Date.parse(record.last_broadcast_at || '');
      if (!Number.isFinite(lastAttempt) || Date.now() - lastAttempt >= BROADCAST_RETRY_MS) {
        await broadcastSavedTransaction(db, provider, record);
      }
    }
  }
}

function safeChainError(error) {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('SURF_DRAW_RPC_URL') || message.startsWith('Wrong chain:') ||
      message.startsWith('Canonical Surf draw') || message.startsWith('On-chain winners') ||
      message.startsWith('Surf draw snapshot')) return message;
  const code = typeof error?.code === 'string' ? error.code.replace(/[^A-Z0-9_]/gi, '').slice(0, 40) : 'unknown';
  return `鏈上讀取失敗（${code}）；請檢查 Surf RPC、合約與網路狀態。`;
}
