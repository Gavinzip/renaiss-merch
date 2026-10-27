import type { SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { useLocale } from '../../i18n/LocaleContext';
import { useSurfStoreInventory } from './SurfStoreInventoryContext';
import { StoreReleaseStatus } from '../MerchStore/StoreReleaseStatus';

const availabilityCopy = {
  'zh-TW': {
    limited: (count: number) => `限量 ${count} 份`,
    before: '尚餘', after: '份', soldOut: '已全數領取',
    loading: '確認中…', error: '名額讀取失敗',
  },
  en: {
    limited: (count: number) => `Limited to ${count}`,
    before: '', after: 'left', soldOut: 'Fully claimed',
    loading: 'Checking…', error: 'Unavailable',
  },
  ko: {
    limited: (count: number) => `한정 ${count}개`,
    before: '', after: '개 남음', soldOut: '수령 마감',
    loading: '확인 중…', error: '확인 불가',
  },
} as const;

export function SurfStoreAvailability({ reward }: { reward: SurfActiveStoreReward }) {
  const { locale } = useLocale();
  const inventory = useSurfStoreInventory();
  const stock = inventory.rewards[reward.id];
  const copy = availabilityCopy[locale];
  const ready = inventory.status === 'ready' && !!stock;
  const state = ready ? stock.soldOut ? 'sold-out' : 'available' : inventory.status;

  if (ready && stock.soldOut) return <StoreReleaseStatus />;

  return <div className="surf-store-availability" data-state={state} role="status"
    title={ready ? copy.limited(stock.limit) : undefined} aria-live="polite" aria-atomic="true">
    <span className="surf-store-availability__remaining" key={`${state}-${stock?.remaining}`}>
      {ready ? stock.soldOut ? copy.soldOut : <>
        {copy.before ? <span>{copy.before}</span> : null}
        <strong>{stock.remaining}</strong><span>{copy.after}</span>
      </> : inventory.status === 'error' ? copy.error : copy.loading}
    </span>
  </div>;
}
