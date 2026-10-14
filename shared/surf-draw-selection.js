// Stable prize slots stay bound to the ledger. Choosing a group only changes
// which unrevealed slots are published first, never which ticket wins a slot.
export function remainingSurfPrizeSlots(prizes, winners, kind) {
  const revealed = new Set(winners.map(winner => winner.slot));
  return prizes.filter(prize => prize.kind === kind && !revealed.has(prize.slot)).map(prize => prize.slot);
}
