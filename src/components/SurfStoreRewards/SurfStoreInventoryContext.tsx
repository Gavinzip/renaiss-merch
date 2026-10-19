import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { readSurfStoreInventory, type SurfInventoryByReward } from '../../lib/surfStoreInventory';

type InventoryState = { status: 'loading' | 'ready' | 'error'; rewards: SurfInventoryByReward };
type InventoryContext = InventoryState & { refresh: () => Promise<void> };
const Context = createContext<InventoryContext | null>(null);

// One count feed is shared by the cards and the currently open Gmail form.
export function SurfStoreInventoryProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [state, setState] = useState<InventoryState>({ status: 'loading', rewards: {} });
  const pending = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    try {
      const rewards = await readSurfStoreInventory(AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]));
      if (!controller.signal.aborted) setState({ status: 'ready', rewards });
    } catch {
      // Never substitute the configured allocation for unavailable live stock.
      if (!controller.signal.aborted) setState({ status: 'error', rewards: {} });
    }
  }, [enabled]);

  useEffect(() => {
    setState({ status: 'loading', rewards: {} });
    if (!enabled) return;
    void refresh();
    const whenVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const interval = window.setInterval(whenVisible, 10_000);
    window.addEventListener('focus', whenVisible);
    document.addEventListener('visibilitychange', whenVisible);
    return () => {
      pending.current?.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', whenVisible);
      document.removeEventListener('visibilitychange', whenVisible);
    };
  }, [enabled, refresh]);

  return <Context.Provider value={{ ...state, refresh }}>{children}</Context.Provider>;
}

export function useSurfStoreInventory() {
  const value = useContext(Context);
  if (!value) throw new Error('surf_inventory_provider_required');
  return value;
}
