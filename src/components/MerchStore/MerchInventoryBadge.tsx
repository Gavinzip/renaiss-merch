import type { MerchProductInventory } from '../../lib/merchInventory';
import type { MerchProductId } from './merchCatalog';
import type { MerchInventoryLoadState } from './useMerchInventory';
import { useLocale } from '../../i18n/LocaleContext';

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
  const { locale } = useLocale();
  const copy = inventoryCopy[locale];
  const shouldRender = productId === 'bracelet' || !!inventory;

  if (!shouldRender) {
    return null;
  }

  const isReady =
    (loadState === 'ready' || loadState === 'stale') && inventory;
  const isSoldOut = !!isReady && inventory.soldOut;
  const label = isReady
    ? loadState === 'stale'
      ? copy.lastKnownAria(inventory.remaining, inventory.limit)
      : isSoldOut
        ? copy.fullyClaimed
        : copy.remainingAria(inventory.remaining, inventory.limit)
    : loadState === 'error'
      ? copy.liveUnavailable
      : copy.checkingLive;

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
            ? copy.lastKnown
            : copy.limitedRelease}
        </span>
        {isReady ? (
          <strong>
            {isSoldOut ? (
              copy.soldOut
            ) : (
              <>
                {copy.left(inventory.remaining, inventory.limit)}
              </>
            )}
          </strong>
        ) : (
          <strong>
            {loadState === 'error'
              ? copy.unavailable
              : copy.checking}
          </strong>
        )}
      </span>
    </div>
  );
}

const inventoryCopy = {
  ko: {
    checking: "수량 확인 중",
    checkingLive: "실시간 수량 확인 중",
    fullyClaimed: "모든 수령이 마감되었습니다",
    lastKnown: "최근 확인 수량",
    lastKnownAria: (remaining: number, limit: number) =>
      `최근 확인 수량: 팔찌 ${limit}개 중 ${remaining}개 남음`,
    left: (remaining: number, limit: number) => (
      <>{limit}개 중 <b>{remaining}</b>개 남음</>
    ),
    limitedRelease: "한정 발매",
    liveUnavailable: "실시간 수량을 확인할 수 없습니다",
    remainingAria: (remaining: number, limit: number) =>
      `팔찌 ${limit}개 중 ${remaining}개 남음`,
    soldOut: "수령 마감",
    unavailable: "확인 불가"
  },
  en: {
    checking: 'Checking availability',
    checkingLive: 'Checking live availability',
    fullyClaimed: 'Release fully claimed',
    lastKnown: 'Last known availability',
    lastKnownAria: (remaining: number, limit: number) =>
      `Last known availability: ${remaining} of ${limit} bracelets remaining`,
    left: (remaining: number, limit: number) => (
      <><b>{remaining}</b> of {limit} left</>
    ),
    limitedRelease: 'Limited release',
    liveUnavailable: 'Live availability unavailable',
    remainingAria: (remaining: number, limit: number) =>
      `${remaining} of ${limit} bracelets remaining`,
    soldOut: 'Sold out',
    unavailable: 'Unavailable'
  },
  'zh-TW': {
    checking: '正在檢查庫存',
    checkingLive: '正在檢查即時庫存',
    fullyClaimed: '此系列已全數領取',
    lastKnown: '最近一次庫存',
    lastKnownAria: (remaining: number, limit: number) =>
      `最近一次庫存：${limit} 條中尚餘 ${remaining} 條手鍊`,
    left: (remaining: number, limit: number) => (
      <><b>{remaining}</b> / {limit} 尚餘</>
    ),
    limitedRelease: '限量發行',
    liveUnavailable: '目前無法取得即時庫存',
    remainingAria: (remaining: number, limit: number) =>
      `${limit} 條中尚餘 ${remaining} 條手鍊`,
    soldOut: '已全數領取',
    unavailable: '無法取得'
  }
} as const;
