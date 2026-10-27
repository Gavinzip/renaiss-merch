import type { SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { useLocale } from '../../i18n/LocaleContext';
import { surfStoreCopy } from './surfStoreCopy';
import type { SurfStoreInventory } from '../../lib/surfStoreInventory';
import { surfAccountCopy } from './surfAccountCopy';

export function SurfRewardFacts({ reward, animate = false, inventory, inventoryStatus }: {
  reward: SurfActiveStoreReward; animate?: boolean; inventory?: SurfStoreInventory;
  inventoryStatus?: 'loading' | 'ready' | 'error';
}) {
  const { locale } = useLocale();
  const copy = surfStoreCopy[locale];

  return (
    <dl className="surf-reward-facts">
      <div data-motion-item={animate || undefined}><dt>{copy.allocation}</dt><dd>{inventoryStatus === 'ready' && inventory
        ? copy.quantity(inventory.limit, reward.approximateQuantity) : copy.pending}</dd></div>
      {inventoryStatus ? <div data-motion-item={animate || undefined} role="status">
        <dt>{surfAccountCopy[locale].remaining}</dt>
        <dd>{inventoryStatus === 'ready' && inventory
          ? inventory.soldOut ? surfAccountCopy[locale].soldOut : copy.quantity(inventory.remaining, false)
          : inventoryStatus === 'error' ? surfAccountCopy[locale].inventoryUnavailable : surfAccountCopy[locale].loading}</dd>
      </div> : null}
      <div data-motion-item={animate || undefined}><dt>{copy.threshold}</dt><dd>{reward.minimumSbtBalance === null ? copy.pending : `${reward.minimumSbtBalance} SBT`}</dd></div>
    </dl>
  );
}
