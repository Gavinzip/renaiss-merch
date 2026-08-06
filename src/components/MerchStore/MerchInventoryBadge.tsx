import type { MerchProductInventory } from '../../lib/merchInventory';
import type { MerchProductId } from './merchCatalog';
import type { MerchInventoryLoadState } from './useMerchInventory';

type MerchInventoryBadgeProps = {
  inventory?: MerchProductInventory;
  loadState: MerchInventoryLoadState;
  productId: MerchProductId;
  variant?: 'card' | 'catalog';
};

export function MerchInventoryBadge({
  inventory,
  loadState,
  productId,
  variant = 'card'
}: MerchInventoryBadgeProps) {
  const shouldRender = productId === 'bracelet' || !!inventory;

  if (!shouldRender) {
    return null;
  }

  const isReady =
    (loadState === 'ready' || loadState === 'stale') && inventory;
  const isSoldOut = !!isReady && inventory.soldOut;
  const label = isReady
    ? loadState === 'stale'
      ? `Last known availability: ${inventory.remaining} of ${inventory.limit} bracelets remaining`
      : isSoldOut
        ? 'Release fully claimed'
        : `${inventory.remaining} of ${inventory.limit} bracelets remaining`
    : loadState === 'error'
      ? 'Live availability unavailable'
      : 'Checking live availability';

  return (
    <div
      aria-label={label}
      className={[
        'merch-inventory-badge',
        `merch-inventory-badge--${variant}`,
        isSoldOut ? 'is-sold-out' : '',
        loadState === 'stale' ? 'is-stale' : '',
        loadState === 'error' ? 'is-error' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
    >
      <span className="merch-inventory-badge__dot" aria-hidden="true" />
      <span className="merch-inventory-badge__copy">
        <span>
          {loadState === 'stale'
            ? 'Last known availability'
            : 'Limited release'}
        </span>
        {isReady ? (
          <strong>
            {isSoldOut ? (
              'Sold out'
            ) : (
              <>
                <b>{inventory.remaining}</b> of {inventory.limit} left
              </>
            )}
          </strong>
        ) : (
          <strong>
            {loadState === 'error'
              ? 'Unavailable'
              : 'Checking availability'}
          </strong>
        )}
      </span>
    </div>
  );
}
