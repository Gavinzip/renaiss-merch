import { HttpError } from '../http.mjs';
import { remainingSurfPrizeSlots } from '../../shared/surf-draw-selection.js';
export function validateSurfRevealSelection(body, chain, prizes) {
  const {
    prizeKind,
    prizeSlots,
    expectedWinnerCount
  } = body;
  if (prizeKind !== 'mystery-box' && prizeKind !== 'surf-pro-month' || !Array.isArray(prizeSlots) || !prizeSlots.length || prizeSlots.some(slot => !Number.isInteger(slot)) || !Number.isInteger(expectedWinnerCount)) throw new HttpError(400, 'invalid_reveal_selection');
  if (expectedWinnerCount !== chain.winnerCount) throw new HttpError(409, 'reveal_slot_changed');
  const available = remainingSurfPrizeSlots(prizes, chain.winners, prizeKind);
  if (prizeSlots.length !== available.length || prizeSlots.some((slot, index) => slot !== available[index])) throw new HttpError(409, 'reveal_slot_changed');
  return prizeSlots;
}
