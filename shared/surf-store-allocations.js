import { surfStoreRewards } from './surf-store-rewards.js';

// Additional allocations become available on the server clock. The original
// allocation and all per-product account/wallet claim keys remain unchanged.
export const surfStoreRestocks = Object.freeze([
  Object.freeze({
    opensAt: '2026-10-27T19:00:00+08:00',
    quantities: Object.freeze({ 'mystery-box': 1, 'pro-month': 15 }),
  }),
]);

export function getSurfStoreAllocation(rewardId, now) {
  if (!Number.isSafeInteger(now)) throw new Error('surf_store_clock_invalid');
  const reward = surfStoreRewards.find(item => item.id === rewardId && item.status !== 'ended');
  if (!reward) throw new Error('surf_reward_invalid');
  return surfStoreRestocks.reduce((limit, restock) =>
    limit + (now >= Date.parse(restock.opensAt) ? restock.quantities[rewardId] : 0), reward.plannedQuantity);
}

export function getNextSurfStoreRestock(now) {
  if (!Number.isSafeInteger(now)) throw new Error('surf_store_clock_invalid');
  return surfStoreRestocks.find(restock => Date.parse(restock.opensAt) > now)?.opensAt ?? null;
}
