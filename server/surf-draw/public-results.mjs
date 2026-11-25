import { getWorkflowDatabase } from '../postgres/statements.mjs';
import { surfWinnerDisplayName } from '../../shared/surf-draw-identity.js';
import { readSurfChain } from './chain.mjs';
import { decodeSurfSnapshot, SURF_DRAW_ID, SURF_DRAW_RETRY_ID, SURF_CHAINLINK_DRAW_ID, SURF_CHAINLINK_REDRAW_ID, SURF_DRAW_PRIZES } from './model.mjs';

const drawIds = new Set([SURF_DRAW_ID, SURF_DRAW_RETRY_ID, SURF_CHAINLINK_DRAW_ID, SURF_CHAINLINK_REDRAW_ID]);

export function projectSurfPublicResults(chain, checkedAt) {
  if (!Number.isInteger(chain.state) || chain.state < 0 || chain.state > 4 ||
      (chain.state > 0 && !chain.ledgerMatch) ||
      (chain.state === 4 && chain.winners.length !== SURF_DRAW_PRIZES.length)) throw new Error('Surf public result integrity failed');
  const winners = chain.winners.map(winner => {
    if (!Number.isInteger(winner.slot) || !SURF_DRAW_PRIZES[winner.slot] ||
        !Number.isSafeInteger(winner.ticketNumber) || winner.ticketNumber < 1 || !winner.participant) throw new Error('Invalid Surf public winner');
    // Never return the ceremony's participant/contact object or signer state.
    return { slot: winner.slot, ticketNumber: winner.ticketNumber, name: surfWinnerDisplayName(winner.participant.name) };
  });
  if (new Set(winners.map(winner => winner.slot)).size !== winners.length ||
      new Set(winners.map(winner => winner.ticketNumber)).size !== winners.length) throw new Error('Duplicate Surf public result');
  return {
    checkedAt, drawId: chain.drawId,
    status: chain.state === 4 ? 'complete' : winners.length ? 'partial' : 'pending',
    prizes: SURF_DRAW_PRIZES,
    winners,
    proof: { chainId: chain.chainId, source: chain.source, block: chain.block, ledgerHash: chain.ledgerHash, requestId: chain.requestId },
  };
}

export async function readSurfPublicResults({ db = getWorkflowDatabase(), readChain = readSurfChain, now = () => new Date().toISOString() } = {}) {
  // SELECT only: public browsing must never initialize a draw, contact table or action.
  const active = await db.prepare('SELECT draw_id FROM surf_draw_active_round WHERE id=1').get();
  if (!drawIds.has(active?.draw_id)) throw new Error('Surf active round is unavailable');
  const record = await db.prepare('SELECT * FROM surf_draw_snapshots WHERE draw_id=?').get(active.draw_id);
  const snapshot = decodeSurfSnapshot(record, active.draw_id);
  if (!snapshot) throw new Error('Surf locked ledger is unavailable');
  const chain = await readChain(snapshot, { drawId: active.draw_id, includeSigner: false, includeSubscription: false });
  try {
    const current = await db.prepare('SELECT draw_id FROM surf_draw_active_round WHERE id=1').get();
    if (current?.draw_id !== active.draw_id) throw new Error('Surf active round changed');
    return projectSurfPublicResults(chain, now());
  } finally {
    chain.provider.destroy();
  }
}
