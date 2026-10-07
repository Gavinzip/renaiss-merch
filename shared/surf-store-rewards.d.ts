export type SurfStoreRewardId = 'mystery-box' | 'pro-month' | 'waves-rsvp';
export type SurfStoreReward = Readonly<{
  id: SurfStoreRewardId;
  plannedQuantity: number;
  approximateQuantity: boolean;
  status: 'planned' | 'ended';
  minimumSbtBalance: number | null;
  redemptionUrl: string | null;
}>;
export type SurfActiveStoreReward = SurfStoreReward & {
  readonly id: Exclude<SurfStoreRewardId, 'waves-rsvp'>;
};
export const surfStoreRewards: readonly SurfStoreReward[];
