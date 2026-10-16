import { useCallback, useEffect, useMemo, useState } from 'react';
import { surfCampaign } from '../../../shared/surf-campaign.js';

export type Prize = { slot: number; kind: 'mystery-box' | 'surf-pro-month'; number: number };
export type Winner = { slot: number; ticketNumber: number; participant: { name: string; walletAddress: string; email: string; xUsername?: string; discordUsername?: string; ticketRange: [number, number] } };
export type Chain = {
  block: number; chainId: number; state: number; ledgerMatch: boolean; requestId: string;
  source: string; signerAddress: string | null; signerAdmin: boolean | null;
  totalTickets: number; prizeSlotCount: number; ledgerHash: string; winnerCount: number; winners: Winner[];
  vrf: { coordinatorAddress: string; subscription: { id: string; balanceWei: string; consumerRegistered: boolean; pendingRequest: boolean } | null };
};
export type DrawStatus = {
  revision: number;
  drawId: string; prizes: Prize[]; closedAt: string | null; actionsEnabled: boolean;
  myTickets: { start: number; end: number } | null;
  candidate: { participants: number; tickets: number; ledgerHash: string } | null;
  snapshot: { preparedAt: string; participants: number; tickets: number; ledgerHash: string } | null;
  chain: Chain | null; chainError: string | null;
  transactions: { action: string; txHash: string; createdAt: string; confirmedAt: string | null; receiptStatus: number | null; broadcastState: string }[];
  actionLock?: { actionKey: string; createdAt: string; recoverable: boolean } | null;
};
export type DrawAction = 'prepare' | 'finalize' | 'request' | 'reveal';

const ADMIN_API = '/api/admin/missions/surf/draw';
const PUBLIC_API = '/api/missions/surf/draw';
export const publicPrizes: Prize[] = [
  ...Array.from({ length: surfCampaign.plannedRewards.mysteryBoxes }, (_, slot) => ({ slot, kind: 'mystery-box' as const, number: slot + 1 })),
  ...Array.from({ length: surfCampaign.plannedRewards.proMonthTrials }, (_, index) => ({ slot: surfCampaign.plannedRewards.mysteryBoxes + index, kind: 'surf-pro-month' as const, number: index + 1 })),
];

const errorCodes: Record<string, string> = {
  surf_draw_access_required: '請重新登入開獎室。',
  operator_bridge_not_deployed: '線上的單次登入流程尚未部署。',
  operator_upstream_unavailable: '目前無法連接線上正式開獎。',
  surf_draw_not_released: 'The formal draw is not enabled or the campaign is not closed.',
  not_enough_tickets: 'The locked ledger needs at least 27 eligible tickets.',
  participant_ledger_changed: 'The participant ledger changed. Reload and review it.',
  locked_ledger_mismatch: 'The locked ledger hash changed.',
  onchain_ledger_mismatch: 'The on-chain ledger differs from the private snapshot.',
  draw_signer_not_authorized: 'The server signer is not an admin of the existing contract.',
  vrf_consumer_not_registered: 'The existing contract is not registered as a VRF consumer.',
  vrf_subscription_not_ready: 'The VRF subscription has a pending request or no balance.',
  draw_gas_limit_exceeded: 'Gas preflight exceeds the block limit. Stop and diagnose the selector.',
  randomness_not_ready: 'VRF randomness is not ready.',
  reveal_slot_changed: 'The next prize slot changed. Reload the page.',
  invalid_reveal_selection: 'Choose a prize group and the number to draw, then try again.',
  prior_action_pending: 'Another draw transaction is awaiting confirmation.',
  draw_state_changed: 'The on-chain draw changed while preparing this action. Reload and review it.',
  prior_action_failed: 'A prior transaction failed. Review it before proceeding.',
  draw_revision_changed: 'The draw was reset. Reload before continuing.',
};

async function request<T>(path: string, body?: Record<string, unknown>, administrator = false, apiBase?: string): Promise<T> {
  const response = await fetch(`${apiBase || (administrator ? ADMIN_API : PUBLIC_API)}${path}`, {
    method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(errorCodes[value.code] || value.code || `HTTP ${response.status}`);
  return value as T;
}

export function useSurfDraw(administrator: boolean, apiBase?: string, enabled = true) {
  const [loaded, setLoaded] = useState<{ administrator: boolean; value: DrawStatus } | null>(null);
  const status = loaded?.administrator === administrator ? loaded.value : null;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<DrawAction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const refresh = useCallback(async () => {
    if (!enabled) { setLoaded(null); setLoadError(null); return; }
    try { setLoaded({ administrator, value: await request<DrawStatus>('', undefined, administrator, apiBase) }); setLoadError(null); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load draw status.'); }
  }, [administrator, apiBase, enabled]);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => { if (!document.hidden) void refresh(); }, 6000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearInterval(poll); window.clearInterval(clock); };
  }, [refresh]);

  const chain = status?.chain;
  const prizes = status?.prizes || publicPrizes;
  const pendingTx = status?.transactions.find((tx) => !tx.confirmedAt);
  const failedTx = status?.transactions.find((tx) => tx.receiptStatus === 0);
  const nextAction = useMemo((): DrawAction | null => {
    if (!status || !chain || status.actionLock && !status.actionLock.recoverable || pendingTx || failedTx) return null;
    if (!status.snapshot && chain.state === 0) return 'prepare';
    if (status.snapshot && chain.state === 0) return 'finalize';
    if (chain.state === 1) return 'request';
    if (chain.state === 3 && chain.winnerCount < prizes.length) return 'reveal';
    return null;
  }, [status, chain, pendingTx, failedTx, prizes]);
  const closed = Boolean(status?.closedAt && now >= Date.parse(status.closedAt));
  const canAct = Boolean(administrator && nextAction && status?.actionsEnabled && closed && !busy && chain &&
    (nextAction === 'prepare' ? (status?.candidate?.tickets || 0) >= prizes.length :
      chain.signerAdmin && chain.vrf.subscription?.consumerRegistered &&
      (nextAction === 'finalize' || chain.ledgerMatch)));

  async function act(action: DrawAction, prizeSlots?: number[]) {
    if (!status || !chain || action !== nextAction || !canAct) return false;
    const ledgerHash = status.snapshot?.ledgerHash || status.candidate?.ledgerHash;
    if (!ledgerHash) return false;
    setBusy(action); setActionError(null); setNotice(null);
    try {
      const result = await request<{ txHash?: string; broadcastState?: string }>(`/${action}`, {
        drawId: status.drawId, ledgerHash, expectedRevision: status.revision,
        ...(action === 'reveal' ? { expectedWinnerCount: chain.winnerCount, prizeSlots,
          prizeKind: prizes.find(prize => prize.slot === prizeSlots?.[0])?.kind } : {}),
      }, true, apiBase);
      setNotice(result.txHash
        ? `${result.broadcastState === 'uncertain' ? 'Broadcast uncertain; check this same transaction hash: ' : 'Transaction recorded: '}${result.txHash}`
        : 'Participant snapshot locked.');
      await refresh();
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Draw action failed.');
      await refresh();
      return false;
    } finally { setBusy(null); }
  }

  return { status, chain, prizes, now, busy, pendingTx, nextAction, canAct,
    error: actionError || loadError || status?.chainError || null, notice, refresh, act,
    unavailable: !administrator ? null : !status?.actionsEnabled ? 'Formal draw disabled' : !closed ? 'Campaign not closed' :
      !chain ? 'Chain unavailable' : status.actionLock && !status.actionLock.recoverable || pendingTx ? 'Previous transaction pending' : failedTx ? 'Previous transaction failed' :
      !chain.signerAddress && nextAction !== 'prepare' ? 'Server signer missing' :
      chain.signerAdmin === false && nextAction !== 'prepare' ? 'Server signer not authorized' :
      nextAction === 'prepare' && (status?.candidate?.tickets || 0) < prizes.length ? 'Not enough eligible tickets' : null,
  };
}
