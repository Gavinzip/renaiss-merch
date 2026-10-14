export function remainingSurfPrizeSlots(
  prizes: { slot: number; kind: 'mystery-box' | 'surf-pro-month' }[],
  winners: { slot: number }[],
  kind: 'mystery-box' | 'surf-pro-month',
): number[];
