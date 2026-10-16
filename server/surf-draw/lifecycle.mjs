import { Interface } from 'ethers';
import { HttpError } from '../http.mjs';
import { activeSurfDrawId, ensureSurfDrawTables, SURF_CHAINLINK_REDRAW_ID } from './model.mjs';
import { surfDrawSourceAddress } from './reveal-receipt.mjs';

const resetEvents = new Interface(['event RoundReset(bytes32 indexed drawId)']);

export function ensureSurfLifecycle(db) {
  ensureSurfDrawTables(db);
  db.exec(`CREATE TABLE IF NOT EXISTS surf_draw_lifecycle (
    draw_id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS surf_draw_round_history (
    draw_id TEXT NOT NULL, revision INTEGER NOT NULL, reset_tx_hash TEXT NOT NULL UNIQUE,
    archived_at TEXT NOT NULL, snapshot_json TEXT, transactions_json TEXT NOT NULL, chain_json TEXT NOT NULL,
    PRIMARY KEY(draw_id,revision)
  );
  CREATE TABLE IF NOT EXISTS surf_draw_reset_context (
    draw_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, chain_json TEXT NOT NULL
  )`);
  db.prepare('INSERT OR IGNORE INTO surf_draw_lifecycle(draw_id,revision) VALUES(?,0)').run(activeSurfDrawId(db));
}

export function surfRevision(db) {
  ensureSurfLifecycle(db);
  return db.prepare('SELECT revision FROM surf_draw_lifecycle WHERE draw_id=?').get(activeSurfDrawId(db)).revision;
}

export function assertSurfRevision(db, expected) {
  if (!Number.isInteger(expected) || expected !== surfRevision(db)) throw new HttpError(409, 'draw_revision_changed');
}

// A confirmed receipt and the canonical event are required before any active
// records move to history. All old signed intents remain in the private DB.
export function archiveConfirmedSurfReset(db, record, receipt) {
  const drawId = activeSurfDrawId(db);
  const source = surfDrawSourceAddress(drawId);
  if (record.draw_id && record.draw_id !== drawId) throw new HttpError(409, 'reset_receipt_invalid');
  if (Number(receipt.status) !== 1 || receipt.to?.toLowerCase() !== source.toLowerCase() ||
      receipt.hash?.toLowerCase() !== record.tx_hash.toLowerCase() || !receipt.logs?.some(log => {
        if (log.address?.toLowerCase() !== source.toLowerCase()) return false;
        try { return resetEvents.parseLog(log)?.args.drawId === drawId; } catch { return false; }
      })) throw new HttpError(409, 'reset_receipt_invalid');
  const expected = Number(record.action.slice('reset:'.length));
  db.transaction(() => {
    const archived = db.prepare('SELECT reset_tx_hash FROM surf_draw_round_history WHERE draw_id=? AND revision=?').get(drawId, expected);
    if (archived?.reset_tx_hash === record.tx_hash) return;
    assertSurfRevision(db, expected);
    const snapshot = db.prepare('SELECT * FROM surf_draw_snapshots WHERE draw_id=?').get(drawId);
    const transactions = db.prepare('SELECT * FROM surf_draw_transactions WHERE draw_id=? ORDER BY created_at').all(drawId);
    const context = db.prepare('SELECT * FROM surf_draw_reset_context WHERE draw_id=? AND revision=?').get(drawId, expected);
    if (!context) throw new HttpError(409, 'reset_context_missing');
    if (!transactions.some(tx => tx.tx_hash === record.tx_hash) ||
        transactions.some(tx => tx.tx_hash !== record.tx_hash && !tx.confirmed_at))
      throw new HttpError(409, 'prior_action_pending');
    db.prepare('INSERT INTO surf_draw_round_history VALUES(?,?,?,?,?,?,?)').run(
      drawId, expected, record.tx_hash, new Date().toISOString(),
      snapshot ? JSON.stringify(snapshot) : null, JSON.stringify(transactions), context.chain_json,
    );
    // The reusable Chainlink round must retain the frozen participant ledger.
    // Its next on-chain commitment is the same reviewed list after reset.
    if (drawId !== SURF_CHAINLINK_REDRAW_ID)
      db.prepare('DELETE FROM surf_draw_snapshots WHERE draw_id=?').run(drawId);
    db.prepare('DELETE FROM surf_draw_transactions WHERE draw_id=?').run(drawId);
    db.prepare('DELETE FROM surf_draw_action_locks WHERE draw_id=?').run(drawId);
    db.prepare('DELETE FROM surf_draw_reset_context WHERE draw_id=?').run(drawId);
    db.prepare('UPDATE surf_draw_lifecycle SET revision=revision+1 WHERE draw_id=?').run(drawId);
  }).immediate();
}
