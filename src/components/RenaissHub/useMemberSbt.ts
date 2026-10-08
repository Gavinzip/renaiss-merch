import { useEffect, useState } from 'react';
import { readMemberBadgeCount, readMemberSbt } from '../../lib/memberSbt';
import type { RenaissUser } from '../../lib/renaissAuth';

type SbtState =
  | { status: 'loading' | 'error' | 'wallet-pending' | 'preview' | 'demo' }
  | { status: 'ready'; count: number; checkedAt: string };
type Snapshot = { identity: string; state: SbtState };
const REQUEST_TIMEOUT_MS = 40_000;

// A user/wallet change immediately invalidates the previous number. Library
// thumbnails do not query the chain, and missing/failed counts never become 0.
export function useMemberSbt(user: RenaissUser | null, preview: boolean) {
  const wallet = user?.safeWalletAddress?.toLowerCase() || '';
  const identity = JSON.stringify([user?.sub || '', wallet]);
  const enabled = Boolean(user && wallet && !preview && !user.isDemo);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setSnapshot({ identity, state: { status: 'loading' } });
    const timeout = window.setTimeout(() => {
      controller.abort();
      setSnapshot({ identity, state: { status: 'error' } });
    }, REQUEST_TIMEOUT_MS);

    void readMemberSbt(request > 0, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        const count = readMemberBadgeCount(result, wallet);
        if (!Number.isFinite(Date.parse(result.checkedAt))) throw new Error('SBT check time is invalid.');
        setSnapshot({ identity, state: { status: 'ready', count, checkedAt: result.checkedAt } });
      })
      .catch(() => {
        if (!controller.signal.aborted) setSnapshot({ identity, state: { status: 'error' } });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [enabled, identity, wallet, request]);

  const state: SbtState = preview ? { status: 'preview' } :
    user?.isDemo ? { status: 'demo' } :
    !wallet ? { status: 'wallet-pending' } :
    snapshot?.identity === identity ? snapshot.state : { status: 'loading' };
  return { state, retry: () => setRequest(value => value + 1) };
}
