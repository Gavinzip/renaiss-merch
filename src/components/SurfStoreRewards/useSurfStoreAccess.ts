import { useCallback, useEffect, useRef, useState } from 'react';
import type { SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { useLocale } from '../../i18n/LocaleContext';

type RewardId = SurfActiveStoreReward['id'];
export type SurfAccessError = { rewardId: RewardId; message: string };

const messages = {
  'zh-TW': { unqualified: '目前持有的 SBT 未達此商品門檻。', notOpen: '尚未到開放時間。', unavailable: '無法確認資格，請稍後再試。' },
  en: { unqualified: 'Your current SBT holdings do not meet this reward’s requirement.', notOpen: 'This reward has not opened yet.', unavailable: 'Eligibility could not be verified. Please retry.' },
  ko: { unqualified: '현재 SBT 보유량이 이 상품의 조건에 미달합니다.', notOpen: '아직 오픈 시간이 아닙니다.', unavailable: '자격을 확인할 수 없습니다. 다시 시도해 주세요.' },
};

export function useSurfStoreAccess(onOpen: (id: RewardId) => void, onLogin: () => void) {
  const { locale } = useLocale();
  const [checkingRewardId, setCheckingRewardId] = useState<RewardId | null>(null);
  const [error, setError] = useState<SurfAccessError | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const open = useCallback(async (rewardId: RewardId) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setCheckingRewardId(rewardId); setError(null);
    try {
      const response = await fetch(`/api/surf-store/access?rewardId=${rewardId}`, {
        cache: 'no-store', headers: { Accept: 'application/json' },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
      });
      const payload = await response.json() as { code?: string };
      if (controller.signal.aborted) return;
      if (response.status === 401) { onLogin(); return; }
      if (!response.ok) {
        const copy = messages[locale];
        setError({ rewardId, message: payload.code === 'surf_sbt_required' ? copy.unqualified : payload.code === 'surf_store_not_open' ? copy.notOpen : copy.unavailable });
        return;
      }
      onOpen(rewardId);
    } catch {
      if (!controller.signal.aborted) setError({ rewardId, message: messages[locale].unavailable });
    } finally {
      if (!controller.signal.aborted) setCheckingRewardId(null);
    }
  }, [locale, onLogin, onOpen]);
  return { open, checkingRewardId, error };
}
