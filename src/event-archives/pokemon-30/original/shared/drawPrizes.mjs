export const STANDARD_PRIZE_COUNT = 10
export const BONUS_PRIZE_SLOT_INDEX = STANDARD_PRIZE_COUNT
export const TOTAL_PRIZE_COUNT = STANDARD_PRIZE_COUNT + 1

export const DRAW_PRIZES = Object.freeze(Array.from({ length: TOTAL_PRIZE_COUNT }, (_, index) => Object.freeze({
  prizeSlotIndex: index,
  kind: index === BONUS_PRIZE_SLOT_INDEX ? 'charizard-gift-box' : 'celebration-box',
  name: index === BONUS_PRIZE_SLOT_INDEX ? '噴火龍典藏公仔禮盒' : 'Pokémon 30th Celebration Box',
})))

/** Two explicit reveals share the same committed ledger and VRF request. */
export function slotsForDrawStep(step, prizeSlotCount, revealedPrizeSlots = []) {
  if (Number(prizeSlotCount) !== TOTAL_PRIZE_COUNT) throw new Error('本次抽獎需鎖定 11 個獎位；不能延伸已鎖定的其他版本帳本。')
  const revealed = new Set(revealedPrizeSlots.map(Number))
  const regular = Array.from({ length: STANDARD_PRIZE_COUNT }, (_, index) => index).filter((index) => !revealed.has(index))
  if (step === 'reveal_winners') {
    if (!regular.length) throw new Error('前 10 個獎位已揭曉，請進行壓軸加碼獎。')
    return regular
  }
  if (step === 'reveal_bonus') {
    if (regular.length) throw new Error('請先揭曉前 10 位得獎者。')
    if (revealed.has(BONUS_PRIZE_SLOT_INDEX)) throw new Error('第 11 個獎位已揭曉。')
    return [BONUS_PRIZE_SLOT_INDEX]
  }
  throw new Error(`不支援的揭曉步驟：${step}`)
}
