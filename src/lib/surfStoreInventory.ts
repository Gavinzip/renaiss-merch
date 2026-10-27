import { surfStoreRewards, type SurfActiveStoreReward } from '../../shared/surf-store-rewards.js';
import { getNextSurfStoreRestock, getSurfStoreAllocation } from '../../shared/surf-store-allocations.js';

export type SurfStoreInventory = {
  rewardId: SurfActiveStoreReward['id'];
  limit: number;
  claimed: number;
  remaining: number;
  soldOut: boolean;
};
export type SurfInventoryByReward = Partial<Record<SurfActiveStoreReward['id'], SurfStoreInventory>>;
export type SurfInventorySnapshot = { rewards: SurfInventoryByReward; refreshAfterMs: number | null };

export async function readSurfStoreInventory(signal: AbortSignal): Promise<SurfInventorySnapshot> {
  const response = await fetch('/api/surf-store/inventory', {
    cache: 'no-store', signal, headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('surf_inventory_unavailable');
  const body = await response.json() as { rewards?: SurfStoreInventory[]; serverNow?: string; nextRestockAt?: string | null };
  const serverNow = typeof body.serverNow === 'string' ? Date.parse(body.serverNow) : NaN;
  const rewards = surfStoreRewards.filter((reward): reward is SurfActiveStoreReward => reward.status !== 'ended');
  if (!Number.isSafeInteger(serverNow) || body.nextRestockAt !== getNextSurfStoreRestock(serverNow) ||
    !Array.isArray(body.rewards) || body.rewards.length !== rewards.length) throw new Error('surf_inventory_invalid');
  const inventory: SurfInventoryByReward = {};
  for (const reward of rewards) {
    const rows = body.rewards.filter(row => row.rewardId === reward.id);
    const row = rows[0];
    if (rows.length !== 1 || !row || row.limit !== getSurfStoreAllocation(reward.id, serverNow) ||
      !Number.isSafeInteger(row.claimed) || row.claimed < 0 || row.claimed > row.limit ||
      row.remaining !== row.limit - row.claimed || row.soldOut !== (row.remaining === 0)) {
      throw new Error('surf_inventory_invalid');
    }
    inventory[row.rewardId] = row;
  }
  return { rewards: inventory, refreshAfterMs: body.nextRestockAt ? Date.parse(body.nextRestockAt) - serverNow : null };
}
