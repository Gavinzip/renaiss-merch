import { randomUUID } from 'node:crypto';
import { keccak256 } from 'ethers';
import { HttpError, sendJson } from '../http.mjs';
import { readSurfChain } from './chain.mjs';
import { activeSurfDrawId, readSnapshot } from './model.mjs';
import { archiveConfirmedSurfReset, assertSurfRevision } from './lifecycle.mjs';
import { assertSurfTransactionTarget, verifySurfRevealReceipt } from './reveal-receipt.mjs';

const ACTION_LOCK_LEASE_MS = 120_000;
const BROADCAST_RETRY_MS = 30_000;

export async function sendSurfDrawAction(res, db, chain, action, transactionFactory, expectedRevision,
  { readChain = readSurfChain } = {}) {
  const drawId = activeSurfDrawId(db);
  if (chain.drawId !== drawId) throw new HttpError(409, 'draw_id_changed');
  const actionKey = `${drawId}:${action}`;
  const lockId = randomUUID();
  const reservation = db.transaction(() => {
    assertSurfRevision(db, expectedRevision);
    if (activeSurfDrawId(db) !== drawId) throw new HttpError(409, 'draw_id_changed');
    const existing = db.prepare('SELECT * FROM surf_draw_transactions WHERE action_key=?').get(actionKey);
    if (existing) return existing;
    if (db.prepare('SELECT 1 FROM surf_draw_transactions WHERE draw_id=? AND confirmed_at IS NULL').get(drawId)) {
      throw new HttpError(409, 'prior_action_pending');
    }
    const priorLock = db.prepare('SELECT lock_id AS lockId,created_at AS createdAt FROM surf_draw_action_locks WHERE draw_id=?').get(drawId);
    if (priorLock) {
      const age = Date.now() - Date.parse(priorLock.createdAt);
      if (!Number.isFinite(age) || age < ACTION_LOCK_LEASE_MS) throw new HttpError(409, 'prior_action_pending');
      // The expired owner may still resume. Its lock-id check below fences it
      // out before its signed transaction can be stored or broadcast.
      db.prepare('DELETE FROM surf_draw_action_locks WHERE draw_id=? AND lock_id=?').run(drawId, priorLock.lockId);
    }
    db.prepare('INSERT INTO surf_draw_action_locks (draw_id,action_key,lock_id,created_at) VALUES(?,?,?,?)')
      .run(drawId, actionKey, lockId, new Date().toISOString());
    return null;
  }).immediate();
  if (reservation) {
    assertSurfTransactionTarget(reservation);
    if (reservation.receipt_status === 0) throw new HttpError(409, 'prior_action_failed');
    const broadcastState = reservation.confirmed_at || reservation.broadcast_state === 'accepted'
      ? reservation.broadcast_state : await broadcastSavedTransaction(db, chain.provider, reservation);
    sendJson(res, 200, { action, txHash: reservation.tx_hash, broadcastState, existing: true });
    return true;
  }
  let raw, txHash, fresh;
  try {
    // The reservation precedes every await. Its ID is checked again before
    // persistence, so an expired owner cannot publish after a new owner starts.
    fresh = await readChain(readSnapshot(db), { drawId });
    assertSurfRevision(db, expectedRevision);
    if (fresh.drawId !== drawId || fresh.state !== chain.state || fresh.winnerCount !== chain.winnerCount ||
        fresh.ledgerHash !== chain.ledgerHash || fresh.ledgerMatch !== chain.ledgerMatch ||
        fresh.requestId !== chain.requestId || fresh.sourceState !== chain.sourceState ||
        fresh.results.address !== chain.results.address || fresh.results.resultId !== chain.results.resultId ||
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
    if (action.startsWith('reset:')) {
      if (nonce !== await fresh.provider.getTransactionCount(fresh.signer.address, 'latest')) throw new HttpError(409, 'prior_action_pending');
      const cost = gasLimit * fee.gasPrice;
      if (cost > 2_000_000_000_000_000n || await fresh.provider.getBalance(fresh.signer.address) < cost)
        throw new HttpError(409, 'reset_gas_budget_exceeded');
    }
    raw = await fresh.signer.signTransaction({ ...tx, chainId: fresh.chainId, type: 0, gasPrice: fee.gasPrice,
      gasLimit, nonce });
    txHash = keccak256(raw);
    assertSurfTransactionTarget({ action, draw_id: drawId, signed_raw: raw, tx_hash: txHash });
    db.transaction(() => {
      assertSurfRevision(db, expectedRevision);
      if (activeSurfDrawId(db) !== drawId) throw new HttpError(409, 'draw_id_changed');
      if (!db.prepare('SELECT 1 FROM surf_draw_action_locks WHERE draw_id=? AND lock_id=?').get(drawId, lockId) ||
          db.prepare('SELECT 1 FROM surf_draw_transactions WHERE draw_id=? AND confirmed_at IS NULL').get(drawId)) {
        throw new HttpError(409, 'prior_action_pending');
      }
      db.prepare('INSERT INTO surf_draw_transactions (action_key,draw_id,action,tx_hash,signed_raw,created_at,broadcast_state) VALUES(?,?,?,?,?,?,?)').run(
        actionKey, drawId, action, txHash, raw, new Date().toISOString(), 'signed',
      );
      db.prepare('DELETE FROM surf_draw_action_locks WHERE draw_id=? AND lock_id=?').run(drawId, lockId);
    }).immediate();
  } finally {
    fresh?.provider.destroy();
    db.prepare('DELETE FROM surf_draw_action_locks WHERE draw_id=? AND lock_id=?').run(drawId, lockId);
  }
  const broadcastState = await broadcastSavedTransaction(db, chain.provider,
    { action_key: actionKey, action, draw_id: drawId, tx_hash: txHash, signed_raw: raw });
  sendJson(res, 202, { action, txHash, broadcastState });
  return true;
}

async function broadcastSavedTransaction(db, provider, record) {
  assertSurfTransactionTarget(record);
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

export async function reconcileSurfTransactions(db, provider) {
  const drawId = activeSurfDrawId(db);
  const pending = db.prepare("SELECT action_key,draw_id,action,tx_hash,signed_raw,broadcast_state,last_broadcast_at FROM surf_draw_transactions WHERE draw_id=? AND (confirmed_at IS NULL OR action LIKE 'reset:%' AND receipt_status=1)").all(drawId);
  for (const record of pending) {
    assertSurfTransactionTarget(record);
    const receipt = await provider.getTransactionReceipt(record.tx_hash);
    if (receipt) {
      const [canonical, finalized] = await Promise.all([provider.getBlock(receipt.blockNumber), provider.getBlock('finalized')]);
      if (!canonical || !finalized || canonical.hash !== receipt.blockHash || finalized.number < receipt.blockNumber) continue;
      if (receipt.hash !== record.tx_hash || receipt.to !== assertSurfTransactionTarget(record).to) throw new HttpError(409, 'draw_transaction_target_invalid');
      if (record.action.startsWith('reveal:') && Number(receipt.status) === 1) {
        await verifySurfRevealReceipt(record, receipt, readSnapshot(db), provider);
      }
      db.prepare('UPDATE surf_draw_transactions SET confirmed_at=?,receipt_status=? WHERE action_key=?')
        .run(new Date().toISOString(), receipt.status, record.action_key);
      if (record.action.startsWith('reset:') && Number(receipt.status) === 1) archiveConfirmedSurfReset(db, record, receipt);
    }
    else if (record.broadcast_state === 'signed' || record.broadcast_state === 'uncertain') {
      const lastAttempt = Date.parse(record.last_broadcast_at || '');
      if (!Number.isFinite(lastAttempt) || Date.now() - lastAttempt >= BROADCAST_RETRY_MS) {
        await broadcastSavedTransaction(db, provider, record);
      }
    }
  }
}
