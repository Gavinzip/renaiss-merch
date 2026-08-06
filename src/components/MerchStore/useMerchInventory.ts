import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import {
  readMerchInventory,
  type MerchProductInventory
} from '../../lib/merchInventory';
import type { MerchProductId } from './merchCatalog';

const INVENTORY_REFRESH_INTERVAL_MS = 10_000;

export type MerchInventoryLoadState =
  | 'loading'
  | 'ready'
  | 'stale'
  | 'error';

export type MerchInventoryScope = 'production' | 'demo';

export function useMerchInventory(scope: MerchInventoryScope) {
  const [inventoryByProduct, setInventoryByProduct] = useState<
    Partial<Record<MerchProductId, MerchProductInventory>>
  >({});
  const [loadState, setLoadState] =
    useState<MerchInventoryLoadState>('loading');
  const requestVersion = useRef(0);
  const hasSuccessfulInventory = useRef(false);

  const refreshInventory = useCallback(async () => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;

    try {
      const nextInventory = await readMerchInventory();

      if (requestVersion.current !== version) {
        return;
      }

      setInventoryByProduct(nextInventory);
      hasSuccessfulInventory.current = true;
      setLoadState('ready');
    } catch {
      if (requestVersion.current === version) {
        setLoadState(
          hasSuccessfulInventory.current ? 'stale' : 'error'
        );
      }
    }
  }, [scope]);

  useEffect(() => {
    hasSuccessfulInventory.current = false;
    setInventoryByProduct({});
    setLoadState('loading');
    void refreshInventory();

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshInventory();
      }
    };
    const refreshInterval = window.setInterval(
      refreshWhenVisible,
      INVENTORY_REFRESH_INTERVAL_MS
    );

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      requestVersion.current += 1;
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshInventory]);

  return {
    inventoryByProduct,
    inventoryLoadState: loadState,
    refreshInventory
  };
}
