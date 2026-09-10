import { useEffect } from 'react';
import { prepareMerchEligibility } from '../../lib/merchEligibility';

export function useEligibilityPreparation(walletAddress: string | null) {
  useEffect(() => {
    if (!walletAddress) return;
    const controller = new AbortController();
    // Give the first paint priority, then prepare in the background once per
    // authenticated wallet. This never changes a tile's sealed/revealed state.
    const timer = window.setTimeout(() => {
      void prepareMerchEligibility(controller.signal).catch((error) => {
        if (!controller.signal.aborted) {
          console.warn('Background eligibility preparation failed; Check Access can retry.', error);
        }
      });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [walletAddress]);
}
