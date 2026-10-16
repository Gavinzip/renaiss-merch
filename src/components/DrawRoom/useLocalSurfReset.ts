import { useCallback, useEffect, useRef, useState } from 'react';

type ResetStatus = {
  revision: number; drawId: string; state: number; winnerCount: number; requestId: string; ledgerHash: string;
  canReset: boolean; reason: string | null; completed?: boolean;
  transaction?: { txHash: string; receiptStatus: number | null; broadcastState: string } | null;
};
const ROOT = '/api/local/surf-operator/draw/reset';
const reasons: Record<string, string> = {
  reset_rpc_not_configured: '線上尚未設定 Surf RPC',
  surf_draw_not_released: '正式開獎尚未啟用',
  draw_signer_not_authorized: '線上簽署錢包尚未就緒',
  reset_randomness_pending: '等待本次 VRF 完成後才能重置',
  onchain_ledger_mismatch: '正式帳本與鏈上帳本不一致',
  prior_action_pending: '等待上一筆交易確認',
  prior_action_failed: '請先核對失敗的重置交易',
  reset_already_draft: '已在帳本提交起點',
  draw_revision_changed: '本輪已重置，請重新讀取',
  draw_state_changed: '開獎狀態已變更，請重新讀取',
  reset_gas_budget_exceeded: 'Gas 餘額不足或超過 0.002 BNB 上限',
  surf_draw_access_required: '請重新登入開獎室',
};
async function request<T>(body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(ROOT, { credentials: 'same-origin', cache: 'no-store',
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  if (!response.ok) throw new Error(reasons[value.code] || `無法重置（${value.code || response.status}）`);
  return value;
}

export function useLocalSurfReset(administrator: boolean, onComplete: () => void) {
  const [status, setStatus] = useState<ResetStatus | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const started = useRef<ResetStatus | null>(null), locked = useRef(false);
  const complete = useRef(onComplete); complete.current = onComplete;
  const alive = useRef(true), readId = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; ++readId.current; }; }, []);
  const refresh = useCallback(async () => {
    if (!administrator) return;
    const id = ++readId.current;
    try {
      const next = await request<ResetStatus>();
      if (!alive.current || readId.current !== id) return;
      setStatus(next); setError('');
      if (next.transaction) setTxHash(next.transaction.txHash);
      if (next.completed || started.current && next.revision > started.current.revision) {
        started.current = null; locked.current = false; setBusy(false); complete.current();
      } else if (next.transaction?.receiptStatus === 0) {
        locked.current = false; setBusy(false); setError(reasons.prior_action_failed);
      } else if (next.transaction?.receiptStatus === null) {
        started.current ??= next; locked.current = true; setBusy(true);
      } else if (started.current && !next.transaction && next.canReset) {
        started.current = null; locked.current = false; setBusy(false);
      }
    } catch (reason) {
      if (alive.current && id === readId.current) setError(reason instanceof Error ? reason.message : '無法讀取重置狀態');
    }
  }, [administrator]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 3000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function reset() {
    if (locked.current || !status?.canReset) return;
    locked.current = true; setBusy(true); setError('');
    const expected = status;
    const body = { drawId: expected.drawId, expectedRevision: expected.revision, expectedState: expected.state,
      expectedRequestId: expected.requestId, expectedWinnerCount: expected.winnerCount, expectedLedgerHash: expected.ledgerHash };
    try {
      const preflight = await request<{ gasBudgetBnb: string }>({ ...body, preflight: true });
      if (!alive.current) return;
      if (!window.confirm(`重置 BSC 正式開獎？\n\n本輪 ${expected.winnerCount} 個結果將移至歷史紀錄，回到帳本提交步驟。\nGas 預算：${preflight.gasBudgetBnb} BNB\n不會自動鎖帳、請求 VRF 或抽獎。`)) {
        locked.current = false; setBusy(false); return;
      }
      started.current = expected;
      const result = await request<{ txHash: string }>(body);
      if (alive.current) setTxHash(result.txHash);
      await refresh();
    } catch (reason) {
      if (!alive.current) return;
      setError(reason instanceof Error ? reason.message : '無法重置');
      // A lost POST response may already have broadcast. Status polling owns
      // recovery, and no fresh request is sent while its outcome is unknown.
      if (!started.current) { locked.current = false; setBusy(false); }
      await refresh();
    }
  }
  return { busy, reset, refresh, txHash, canReset: administrator && Boolean(status?.canReset),
    message: !administrator ? reasons.surf_draw_access_required : error || (status?.reason ? reasons[status.reason] || status.reason : '') };
}
