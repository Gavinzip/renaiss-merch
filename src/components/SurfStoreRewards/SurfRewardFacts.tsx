import type { SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { useLocale } from '../../i18n/LocaleContext';
import { surfStoreCopy } from './surfStoreCopy';

export function SurfRewardFacts({ reward }: { reward: SurfActiveStoreReward }) {
  const { locale } = useLocale();
  const copy = surfStoreCopy[locale];

  return (
    <dl className="surf-reward-facts">
      <div><dt>{copy.allocation}</dt><dd>{copy.quantity(reward.plannedQuantity, reward.approximateQuantity)}</dd></div>
      <div><dt>{copy.threshold}</dt><dd>{reward.minimumSbtBalance === null ? copy.pending : `${reward.minimumSbtBalance} SBT`}</dd></div>
    </dl>
  );
}
