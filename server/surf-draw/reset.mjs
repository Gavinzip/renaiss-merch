import { formatEther } from 'ethers';
import { HttpError, sendJson } from '../http.mjs';
import { getMerchDatabase } from '../merch-database.mjs';
import { getRuntimeConfig } from '../runtime-config.mjs';
import { readJsonBody } from '../shipping-details.mjs';
import { publicChainState, readSurfChain } from './chain.mjs';
import { assertSurfRevision, surfRevision } from './lifecycle.mjs';
import { activeSurfDrawId, readSnapshot, SURF_CHAINLINK_REDRAW_ID } from './model.mjs';
import { reconcileSurfTransactions, sendSurfDrawAction } from './transactions.mjs';

export function surfResetBlockReason(db, chain, snapshot) {
  const drawId = activeSurfDrawId(db);
  if (chain.vrf.provider === 'chainlink-v2.5' && drawId !== SURF_CHAINLINK_REDRAW_ID) return 'chainlink_round_cannot_reset';
  if (process.env.SURF_DRAW_ENABLED !== 'true') return 'surf_draw_not_released';
  if (!chain.signerAddress || !chain.signerAdmin) return 'draw_signer_not_authorized';
  if (chain.state === 2 && drawId !== SURF_CHAINLINK_REDRAW_ID) return 'reset_randomness_pending';
  if (chain.state !== 0 && (!snapshot || !chain.ledgerMatch)) return 'onchain_ledger_mismatch';
  if (db.prepare('SELECT 1 FROM surf_draw_transactions WHERE draw_id=? AND confirmed_at IS NULL').get(drawId) ||
      db.prepare('SELECT 1 FROM surf_draw_action_locks WHERE draw_id=?').get(drawId)) return 'prior_action_pending';
  if (db.prepare("SELECT 1 FROM surf_draw_transactions WHERE draw_id=? AND action LIKE 'reset:%' AND receipt_status=0").get(drawId))
    return 'prior_action_failed';
  if (chain.state === 0) return 'reset_already_draft';
  return null;
}

// Called only after a local-origin grant authenticated with draw-room
// credentials. The authoritative database and signer stay online.
export async function handleSurfReset(req, res) {
  if (!process.env.SURF_DRAW_RPC_URL?.trim()) throw new HttpError(503, 'reset_rpc_not_configured');
  const db = getMerchDatabase(getRuntimeConfig().databasePath);
  const drawId = activeSurfDrawId(db);
  const revision = surfRevision(db);
  let chain;
  try {
    chain = await readSurfChain(readSnapshot(db), { drawId, includeSubscription: false });
    await reconcileSurfTransactions(db, chain.provider);
    if (surfRevision(db) !== revision) {
      sendJson(res, 200, { revision: surfRevision(db), completed: true, canReset: false, reason: 'reset_already_draft' });
      return true;
    }
    const snapshot = readSnapshot(db);
    const reason = surfResetBlockReason(db, chain, snapshot);
    if (req.method === 'GET') {
      const transaction = db.prepare("SELECT tx_hash AS txHash,broadcast_state AS broadcastState,receipt_status AS receiptStatus FROM surf_draw_transactions WHERE draw_id=? AND action LIKE 'reset:%' ORDER BY created_at DESC LIMIT 1").get(drawId);
      sendJson(res, 200, { drawId, revision, canReset: !reason, reason, transaction: transaction || null,
        state: chain.state, winnerCount: chain.winnerCount, requestId: chain.requestId, ledgerHash: chain.ledgerHash });
      return true;
    }
    const body = await readJsonBody(req);
    assertSurfRevision(db, body.expectedRevision);
    if (body.drawId !== drawId || body.expectedState !== chain.state ||
        body.expectedRequestId !== chain.requestId || body.expectedWinnerCount !== chain.winnerCount ||
        body.expectedLedgerHash !== chain.ledgerHash) throw new HttpError(409, 'draw_state_changed');
    // Repeated requests resume exactly the existing intent, never a new reset.
    const existing = db.prepare('SELECT 1 FROM surf_draw_transactions WHERE action_key=?').get(`${drawId}:reset:${revision}`);
    if (reason && !(existing && reason === 'prior_action_pending')) throw new HttpError(409, reason);
    if (!existing) {
      const tx = await chain.contract.resetDraft.populateTransaction(drawId);
      const gas = await chain.provider.estimateGas({ ...tx, from: chain.signerAddress });
      const fee = await chain.provider.getFeeData();
      if (!fee.gasPrice) throw new HttpError(503, 'gas_price_unavailable');
      const cost = gas * 120n / 100n * fee.gasPrice;
      if (cost > 2_000_000_000_000_000n || await chain.provider.getBalance(chain.signerAddress) < cost)
        throw new HttpError(409, 'reset_gas_budget_exceeded');
      if (body.preflight === true) {
        sendJson(res, 200, { ready: true, gasBudgetBnb: formatEther(cost), revision });
        return true;
      }
      db.transaction(() => {
        assertSurfRevision(db, revision);
        const blocked = surfResetBlockReason(db, chain, readSnapshot(db));
        if (blocked) throw new HttpError(409, blocked);
        db.prepare('INSERT OR REPLACE INTO surf_draw_reset_context VALUES(?,?,?)').run(drawId, revision, JSON.stringify(publicChainState(chain)));
      }).immediate();
    }
    return await sendSurfDrawAction(res, db, chain, `reset:${revision}`,
      () => chain.contract.resetDraft.populateTransaction(drawId), revision);
  } finally { chain?.provider.destroy(); }
}
