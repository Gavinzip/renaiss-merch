import { surfStoreRewards, type SurfActiveStoreReward } from '../../shared/surf-store-rewards.js';

export type SurfStoreInventory = {
  rewardId: SurfActiveStoreReward['id'];
  limit: number;
  claimed: number;
  remaining: number;
  soldOut: boolean;
};
export type SurfInventoryByReward = Partial<Record<SurfActiveStoreReward['id'], SurfStoreInventory>>;

export async function readSurfStoreInventory(signal: AbortSignal): Promise<SurfInventoryByReward> {
  const response = await fetch('/api/surf-store/inventory', {
    cache: 'no-store', signal, headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('surf_inventory_unavailable');
  const body = await response.json() as { rewards?: SurfStoreInventory[] };
  const rewards = surfStoreRewards.filter(reward => reward.status !== 'ended');
  if (!Array.isArray(body.rewards) || body.rewards.length !== rewards.length) throw new Error('surf_inventory_invalid');
  const inventory: SurfInventoryByReward = {};
  for (const reward of rewards) {
    const rows = body.rewards.filter(row => row.rewardId === reward.id);
    const row = rows[0];
    if (rows.length !== 1 || !row || row.limit !== reward.plannedQuantity ||
      !Number.isSafeInteger(row.claimed) || row.claimed < 0 || row.claimed > row.limit ||
      row.remaining !== row.limit - row.claimed || row.soldOut !== (row.remaining === 0)) {
      throw new Error('surf_inventory_invalid');
    }
    inventory[row.rewardId] = row;
  }
  return inventory;
}
