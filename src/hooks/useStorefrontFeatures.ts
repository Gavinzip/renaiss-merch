import { useEffect, useState } from 'react';

export type SurfStoreRelease = { opensAt: string; serverNow: string; open: boolean };

type FeaturesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; surfRewardsVisible: boolean; surfStoreRelease: SurfStoreRelease | null };

export function useStorefrontFeatures(enabled: boolean) {
  const [state, setState] = useState<FeaturesState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setState({ status: 'ready', surfRewardsVisible: false, surfStoreRelease: null });
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let requestRevision = 0;
    setState({ status: 'loading' });
    async function refresh() {
      const currentRevision = ++requestRevision;
      clearTimeout(timer);
      try {
        const response = await fetch('/api/storefront/features', {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) throw new Error('storefront_features_unavailable');
        const data = await response.json() as { surfRewardsVisible?: unknown; surfStoreRelease?: SurfStoreRelease };
        if (typeof data.surfRewardsVisible !== 'boolean') throw new Error('invalid_storefront_features');
        const release = data.surfStoreRelease;
        if (!release || typeof release.open !== 'boolean' ||
            typeof release.opensAt !== 'string' || typeof release.serverNow !== 'string' ||
            !Number.isFinite(Date.parse(release.opensAt)) || !Number.isFinite(Date.parse(release.serverNow))) {
          throw new Error('invalid_surf_store_release');
        }
        if (controller.signal.aborted || currentRevision !== requestRevision) return;
        setState({ status: 'ready', surfRewardsVisible: data.surfRewardsVisible, surfStoreRelease: release });
        // The timer asks the server again; it never unlocks using the device clock.
        if (!release.open) {
          timer = setTimeout(() => void refresh(), Math.min(60_000, Math.max(250, Date.parse(release.opensAt) - Date.parse(release.serverNow))));
        }
      } catch {
        if (!controller.signal.aborted && currentRevision === requestRevision) {
          setState({ status: 'error' });
          timer = setTimeout(() => void refresh(), 10_000);
        }
      }
    }
    function onVisible() { if (document.visibilityState === 'visible') void refresh(); }
    void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [revision, enabled]);
  return { state, retry: () => setRevision(value => value + 1) };
}
