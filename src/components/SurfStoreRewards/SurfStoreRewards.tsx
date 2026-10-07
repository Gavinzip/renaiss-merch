import { surfStoreRewards, type SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { SurfStoreRewardCard } from './SurfStoreRewardCard';
import './SurfStoreRewards.css';

export default function SurfStoreRewards() {
  return (
    <>
      {surfStoreRewards
        .filter((reward): reward is SurfActiveStoreReward => reward.id !== 'waves-rsvp' && reward.status !== 'ended')
        .map(reward => <SurfStoreRewardCard key={reward.id} reward={reward} />)}
    </>
  );
}
