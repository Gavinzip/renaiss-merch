import { useCallback, useEffect, useRef, useState } from 'react';
import type { SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { useSurfStoreInventory } from './SurfStoreInventoryContext';

export type SurfClaimReceipt = { id: string; rewardId: string; gmail: string; allocationNumber: number; submittedAt: string };
type ClaimState = {
  claim: SurfClaimReceipt | null;
  inventory: { rewardId: string; limit: number; remaining: number; soldOut: boolean };
};

export function useSurfStoreClaim(rewardId: SurfActiveStoreReward['id'], enabled: boolean) {
  const inventory = useSurfStoreInventory();
  const { refresh: refreshInventory } = inventory;
  const [data, setData] = useState<ClaimState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const submittingRef = useRef(false);
  const submissionRevision = useRef(0);
  const pendingSubmission = useRef<AbortController | null>(null);
  const previousSoldOut = useRef<boolean | undefined>(undefined);
  const stock = inventory.rewards[rewardId];
  useEffect(() => {
    if (inventory.status !== 'ready' || !stock) return;
    const reopened = previousSoldOut.current === true && !stock.soldOut;
    previousSoldOut.current = stock.soldOut;
    // A server-confirmed restock clears a previous sold-out submission error.
    if (reopened && error === 'surf_sold_out') {
      setError(null);
      setRevision(value => value + 1);
    }
  }, [inventory.status, stock, error]);
  useEffect(() => () => pendingSubmission.current?.abort(), []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const currentSubmission = submissionRevision.current;
    setLoading(true); setError(null);
    void (async () => {
      try {
        const response = await fetch(`/api/surf-store/claim?rewardId=${rewardId}`, {
          cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
          headers: { Accept: 'application/json' },
        });
        const payload = await response.json() as ClaimState & { code?: string };
        if (!response.ok) throw new Error(payload.code || 'surf_claim_unavailable');
        if (!payload.inventory || !Number.isSafeInteger(payload.inventory.remaining)) throw new Error('surf_claim_unavailable');
        if (!controller.signal.aborted && currentSubmission === submissionRevision.current) setData(payload);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'surf_claim_unavailable');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [enabled, rewardId, revision]);

  const submit = useCallback(async (email: string) => {
    if (submittingRef.current) return;
    const controller = new AbortController();
    pendingSubmission.current = controller;
    submittingRef.current = true; setSubmitting(true); setError(null);
    submissionRevision.current++;
    try {
      const response = await fetch('/api/surf-store/claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(90_000)]),
        body: JSON.stringify({ rewardId, gmail: email }),
      });
      const payload = await response.json() as { claim?: SurfClaimReceipt; code?: string };
      if (!response.ok) throw new Error(payload.code || 'surf_claim_unavailable');
      if (!payload.claim || payload.claim.rewardId !== rewardId) throw new Error('surf_claim_unavailable');
      if (!controller.signal.aborted) setData(current => current ? { ...current, claim: payload.claim! } : current);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'surf_claim_unavailable');
    } finally {
      submittingRef.current = false;
      if (!controller.signal.aborted) setSubmitting(false);
      if (!controller.signal.aborted) void refreshInventory();
    }
  }, [rewardId, refreshInventory]);
  return { data, loading, submitting, error, submit, retry: () => setRevision(value => value + 1) };
}
