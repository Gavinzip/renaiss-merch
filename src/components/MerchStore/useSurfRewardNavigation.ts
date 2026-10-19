import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { transitionElements, type ElementTransition } from '../../lib/elementTransition';

const storeItems = [
  '.hub-site-header > *', '.merch-store__intro h1', '.merch-store__intro p',
  '.merch-product-card__visual', '.merch-product-card__body h2',
  '.merch-product-card__description', '.merch-product-card__access',
  '.surf-store-card__visual', '.surf-store-card__body > *',
  '.merch-store__status', '.merch-store__footer > *'
].join(', ');

export function useSurfRewardNavigation(storeRoot: RefObject<HTMLElement | null>) {
  const [openRewardId, setOpenRewardId] = useState<SurfActiveStoreReward['id'] | null>(null);
  const returnTo = useRef<{ scroll: number; rewardId: SurfActiveStoreReward['id'] } | null>(null);
  const transition = useRef<ElementTransition | undefined>(undefined);

  const open = useCallback((rewardId: SurfActiveStoreReward['id']) => {
    returnTo.current = { scroll: window.scrollY, rewardId };
    transition.current?.cancel();
    setOpenRewardId(rewardId);
  }, [storeRoot]);
  const close = useCallback(() => setOpenRewardId(null), []);

  useLayoutEffect(() => {
    if (openRewardId || !returnTo.current || !storeRoot.current) return;
    const { scroll, rewardId } = returnTo.current;
    window.scrollTo({ top: scroll, behavior: 'instant' });
    storeRoot.current.querySelector<HTMLElement>(`[data-surf-reward-opener="${rewardId}"]`)?.focus({ preventScroll: true });
    transition.current = transitionElements(storeRoot.current, storeItems, 'enter', transition.current, false, true,
      { duration: 400, stagger: 24, maxDelay: 120 });
    returnTo.current = null;
  }, [openRewardId, storeRoot]);

  useLayoutEffect(() => () => transition.current?.cancel(), []);
  return { openRewardId, open, close };
}
