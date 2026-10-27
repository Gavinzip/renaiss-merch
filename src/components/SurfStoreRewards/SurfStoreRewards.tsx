import { surfStoreRewards, type SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { SurfStoreRewardCard } from './SurfStoreRewardCard';
import './SurfStoreRewards.css';
import type { SurfStoreRelease } from '../../hooks/useStorefrontFeatures';
import type { SurfAccessError } from './useSurfStoreAccess';
import { useSurfStoreInventory } from './SurfStoreInventoryContext';

type Props = {
  release: SurfStoreRelease | null;
  onOpenReward: (id: SurfActiveStoreReward['id']) => void;
  checkingRewardId: SurfActiveStoreReward['id'] | null;
  error: SurfAccessError | null;
};

export default function SurfStoreRewards({ release, onOpenReward, checkingRewardId, error }: Props) {
  const inventory = useSurfStoreInventory();
  return (
    <>
      {surfStoreRewards
        .filter((reward): reward is SurfActiveStoreReward => reward.id !== 'waves-rsvp' && reward.status !== 'ended')
        // Keep Pro off the storefront until the server confirms its postponed allocation.
        .filter(reward => reward.id !== 'pro-month' ||
          (inventory.status === 'ready' && (inventory.rewards[reward.id]?.limit ?? 0) > reward.plannedQuantity))
        .map(reward => <SurfStoreRewardCard key={reward.id} reward={reward} release={release}
          onOpenReward={onOpenReward} checking={checkingRewardId === reward.id}
          busy={checkingRewardId !== null} error={error?.rewardId === reward.id ? error.message : null} />)}
    </>
  );
}
