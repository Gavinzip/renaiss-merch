import { useEffect, useState } from 'react';

type FeaturesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; surfRewardsVisible: boolean };

export function useStorefrontFeatures(enabled: boolean) {
  const [state, setState] = useState<FeaturesState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setState({ status: 'ready', surfRewardsVisible: false });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    void (async () => {
      try {
        const response = await fetch('/api/storefront/features', {
          signal: controller.signal, headers: { Accept: 'application/json' }
        });
        if (!response.ok) throw new Error('storefront_features_unavailable');
        const data = await response.json() as { surfRewardsVisible?: unknown };
        if (typeof data.surfRewardsVisible !== 'boolean') throw new Error('invalid_storefront_features');
        if (!controller.signal.aborted) setState({ status: 'ready', surfRewardsVisible: data.surfRewardsVisible });
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' });
      }
    })();
    return () => controller.abort();
  }, [revision, enabled]);
  return { state, retry: () => setRevision(value => value + 1) };
}
