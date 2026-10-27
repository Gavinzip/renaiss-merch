import type { SurfActiveStoreReward } from './surf-store-rewards.js';

export const surfStoreRestocks: readonly Readonly<{
  opensAt: string;
  quantities: Readonly<Record<SurfActiveStoreReward['id'], number>>;
}>[];
export function getSurfStoreAllocation(rewardId: SurfActiveStoreReward['id'], now: number): number;
export function getNextSurfStoreRestock(now: number): string | null;
