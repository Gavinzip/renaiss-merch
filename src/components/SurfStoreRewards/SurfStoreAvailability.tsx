import type { SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { useLocale } from '../../i18n/LocaleContext';
import { useSurfStoreInventory } from './SurfStoreInventoryContext';

const availabilityCopy = {
  'zh-TW': {
    limited: (count: number) => `限量 ${count} 份`,
    before: '尚餘', after: '份', soldOut: '已全數領取',
    loading: '確認名額中…', error: '暫時無法取得名額',
  },
  en: {
    limited: (count: number) => `Limited to ${count}`,
    before: '', after: 'remaining', soldOut: 'Fully claimed',
    loading: 'Checking availability…', error: 'Availability unavailable',
  },
  ko: {
    limited: (count: number) => `한정 ${count}개`,
    before: '', after: '개 남음', soldOut: '수령 마감',
    loading: '수량 확인 중…', error: '수량 확인 불가',
  },
} as const;

export function SurfStoreAvailability({ reward }: { reward: SurfActiveStoreReward }) {
  const { locale } = useLocale();
  const inventory = useSurfStoreInventory();
  const stock = inventory.rewards[reward.id];
  const copy = availabilityCopy[locale];
  const ready = inventory.status === 'ready' && !!stock;
  const state = ready ? stock.soldOut ? 'sold-out' : 'available' : inventory.status;

  return <div className="surf-store-availability" data-state={state} role="status" aria-live="polite" aria-atomic="true">
    <span className="surf-store-availability__edition">{copy.limited(reward.plannedQuantity)}</span>
    <span className="surf-store-availability__remaining" key={`${state}-${stock?.remaining}`}>
      {ready ? stock.soldOut ? copy.soldOut : <>
        {copy.before ? <span>{copy.before}</span> : null}
        <strong>{stock.remaining}</strong><span>{copy.after}</span>
      </> : inventory.status === 'error' ? copy.error : copy.loading}
    </span>
  </div>;
}
