import { keccak256, toUtf8Bytes } from 'ethers';
import { HttpError, sendJson } from '../http.mjs';
import { getMerchDatabase } from '../merch-database.mjs';
import { getRuntimeConfig } from '../runtime-config.mjs';
import { readJsonBody } from '../shipping-details.mjs';
import { readSurfChain } from './chain.mjs';
import { activeSurfDrawId, readSnapshot, SURF_DRAW_ADDRESS, SURF_DRAW_ID, SURF_DRAW_RETRY_ID } from './model.mjs';

const reason = 'binance_vrf_request_unfulfilled';

function frozenSuccessor(db) {
  const old = readSnapshot(db, SURF_DRAW_ID);
  if (!old) throw new HttpError(409, 'draw_snapshot_missing');
  const canonicalJson = JSON.stringify({ ...old.canonical, drawId: SURF_DRAW_RETRY_ID });
  const contact = db.prepare('SELECT * FROM surf_draw_contact_snapshots WHERE draw_id=? AND prepared_at=?')
    .get(SURF_DRAW_ID, old.prepared_at);
  if (!contact) throw new HttpError(409, 'draw_contacts_missing');
  return { old, contact, canonicalJson, ledgerHash: keccak256(toUtf8Bytes(canonicalJson)) };
}

function requestTransaction(db) {
  const record = db.prepare("SELECT tx_hash,confirmed_at,receipt_status FROM surf_draw_transactions WHERE draw_id=? AND action='request'")
    .get(SURF_DRAW_ID);
  if (!record?.confirmed_at || record.receipt_status !== 1) throw new HttpError(409, 'old_request_not_confirmed');
  return record;
}

async function replacementPreflight(db) {
  const active = activeSurfDrawId(db);
  if (active === SURF_DRAW_RETRY_ID) {
    const record = db.prepare('SELECT * FROM surf_draw_superseded_rounds WHERE successor_draw_id=?').get(SURF_DRAW_RETRY_ID);
    if (!record) throw new HttpError(409, 'round_history_missing');
    return { completed: true, canReplace: false, oldDrawId: SURF_DRAW_ID, newDrawId: SURF_DRAW_RETRY_ID,
      oldLedgerHash: record.old_ledger_hash, newLedgerHash: record.new_ledger_hash,
      requestId: record.request_id, requestTxHash: record.request_tx_hash,
      requestBlock: record.request_block, observedBlock: record.observed_block };
  }
  if (active !== SURF_DRAW_ID) throw new HttpError(409, 'draw_id_changed');
  if (process.env.SURF_DRAW_ENABLED !== 'true') throw new HttpError(409, 'surf_draw_not_released');
  const { old, canonicalJson, ledgerHash } = frozenSuccessor(db);
  const request = requestTransaction(db);
  if (db.prepare('SELECT 1 FROM surf_draw_transactions WHERE draw_id=? AND confirmed_at IS NULL').get(SURF_DRAW_ID) ||
      db.prepare('SELECT 1 FROM surf_draw_action_locks WHERE draw_id=?').get(SURF_DRAW_ID)) {
    throw new HttpError(409, 'prior_action_pending');
  }
  if (db.prepare('SELECT 1 FROM surf_draw_snapshots WHERE draw_id=?').get(SURF_DRAW_RETRY_ID)) {
    throw new HttpError(409, 'successor_already_prepared');
  }
  const oldChain = await readSurfChain(old, { includeSubscription: false });
  try {
    const receipt = await oldChain.provider.getTransactionReceipt(request.tx_hash);
    const requestBlock = receipt ? await oldChain.provider.getBlock(receipt.blockNumber) : null;
    if (!receipt || Number(receipt.status) !== 1 || receipt.hash?.toLowerCase() !== request.tx_hash.toLowerCase() ||
        !requestBlock || requestBlock.hash !== receipt.blockHash ||
        receipt.to?.toLowerCase() !== SURF_DRAW_ADDRESS.toLowerCase() ||
        oldChain.block - receipt.blockNumber < 256) throw new HttpError(409, 'request_not_timed_out');
    const nextChain = await readSurfChain(null, { provider: oldChain.provider, drawId: SURF_DRAW_RETRY_ID,
      blockNumber: oldChain.block, includeSubscription: false, includeSigner: false });
    if (oldChain.state !== 2 || oldChain.sourceState !== 2 || !oldChain.ledgerMatch || !oldChain.results.ready ||
        oldChain.requestId === '0' || oldChain.winnerCount !== 0 || oldChain.results.bound ||
        nextChain.state !== 0 || nextChain.requestId !== '0' || nextChain.totalTickets !== 0 ||
        nextChain.winnerCount !== 0 || !nextChain.results.ready || nextChain.results.bound) throw new HttpError(409, 'draw_state_changed');
    if (!oldChain.signerAdmin) throw new HttpError(403, 'draw_signer_not_authorized');
    return { completed: false, canReplace: true, oldDrawId: SURF_DRAW_ID, newDrawId: SURF_DRAW_RETRY_ID,
      oldLedgerHash: old.ledger_hash, newLedgerHash: ledgerHash, requestId: oldChain.requestId,
      requestTxHash: request.tx_hash, requestBlock: receipt.blockNumber,
      participants: old.participant_count, tickets: old.ticket_count,
      prizes: old.canonical.prizes.length, preparedAt: old.prepared_at, observedBlock: oldChain.block,
      canonicalJson };
  } finally { oldChain.provider.destroy(); }
}

// This archives an unfulfilled request and selects a new draw ID. It never
// calls the contract or recomputes tickets from the mutable roster.
export async function handleSurfRoundReplacement(req, res) {
  const db = getMerchDatabase(getRuntimeConfig().databasePath);
  // Parse before the finalized-chain check so a slow client cannot extend the
  // interval between observing the old pending state and committing cutover.
  const body = req.method === 'POST' ? await readJsonBody(req) : null;
  const ready = await replacementPreflight(db);
  if (req.method === 'GET') {
    const { canonicalJson: _canonicalJson, ...safe } = ready;
    sendJson(res, 200, safe); return true;
  }
  if (ready.completed) {
    sendJson(res, 200, { completed: true, oldDrawId: ready.oldDrawId, newDrawId: ready.newDrawId }); return true;
  }
  if (body.confirm !== true || body.oldDrawId !== ready.oldDrawId || body.newDrawId !== ready.newDrawId ||
      body.oldLedgerHash !== ready.oldLedgerHash || body.newLedgerHash !== ready.newLedgerHash ||
      body.requestId !== ready.requestId || body.requestTxHash !== ready.requestTxHash) {
    throw new HttpError(409, 'draw_state_changed');
  }
  commitSurfRoundReplacement(db, ready);
  // Verify the copied commitment and contact hash through the normal reader.
  readSnapshot(db, SURF_DRAW_RETRY_ID);
  sendJson(res, 200, { completed: true, oldDrawId: SURF_DRAW_ID, newDrawId: SURF_DRAW_RETRY_ID });
  return true;
}

export function commitSurfRoundReplacement(db, ready) {
  if (ready.oldDrawId !== SURF_DRAW_ID || ready.newDrawId !== SURF_DRAW_RETRY_ID ||
      !/^\d+$/.test(ready.requestId || '') ||
      !Number.isInteger(ready.requestBlock) || !Number.isInteger(ready.observedBlock) ||
      ready.observedBlock - ready.requestBlock < 256) throw new HttpError(409, 'draw_state_changed');
  db.transaction(() => {
    if (activeSurfDrawId(db) !== SURF_DRAW_ID ||
        db.prepare('SELECT 1 FROM surf_draw_snapshots WHERE draw_id=?').get(SURF_DRAW_RETRY_ID) ||
        db.prepare('SELECT 1 FROM surf_draw_transactions WHERE draw_id=? AND confirmed_at IS NULL').get(SURF_DRAW_ID) ||
        db.prepare('SELECT 1 FROM surf_draw_action_locks WHERE draw_id=?').get(SURF_DRAW_ID)) {
      throw new HttpError(409, 'draw_state_changed');
    }
    const { old, contact, canonicalJson, ledgerHash } = frozenSuccessor(db);
    if (old.ledger_hash !== ready.oldLedgerHash || ledgerHash !== ready.newLedgerHash ||
        requestTransaction(db).tx_hash !== ready.requestTxHash || canonicalJson !== ready.canonicalJson) {
      throw new HttpError(409, 'draw_state_changed');
    }
    const now = new Date().toISOString();
    db.prepare('INSERT INTO surf_draw_snapshots VALUES(?,?,?,?,?,?,?)').run(SURF_DRAW_RETRY_ID,
      ledgerHash, old.ticket_count, old.participant_count, canonicalJson, old.prepared_at, old.prepared_by);
    db.prepare('INSERT INTO surf_draw_contact_snapshots VALUES(?,?,?,?,?)').run(SURF_DRAW_RETRY_ID,
      old.prepared_at, ledgerHash, contact.contacts_json, contact.contacts_hash);
    db.prepare('INSERT INTO surf_draw_superseded_rounds VALUES(?,?,?,?,?,?,?,?,?,?)').run(SURF_DRAW_ID,
      SURF_DRAW_RETRY_ID, ready.requestId, ready.requestTxHash, ready.requestBlock, old.ledger_hash, ledgerHash,
      ready.observedBlock, now, reason);
    db.prepare('UPDATE surf_draw_active_round SET draw_id=?,updated_at=? WHERE id=1').run(SURF_DRAW_RETRY_ID, now);
  }).immediate();
}
