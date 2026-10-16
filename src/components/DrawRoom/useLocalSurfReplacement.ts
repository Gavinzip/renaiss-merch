import { useCallback, useEffect, useState } from 'react';

type Replacement = {
  completed: boolean; canReplace: boolean; oldDrawId: string; newDrawId: string;
  oldLedgerHash: string; newLedgerHash: string; requestId: string; requestTxHash: string;
  participants?: number; tickets?: number; prizes?: number;
};

const ROOT = '/api/local/surf-operator/draw/replace';

async function request(body?: Record<string, unknown>): Promise<Replacement> {
  const response = await fetch(ROOT, { credentials: 'same-origin', cache: 'no-store',
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.code || `HTTP ${response.status}`);
  return value;
}

export function useLocalSurfReplacement(authenticated: boolean, onComplete: () => void) {
  const [status, setStatus] = useState<Replacement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!authenticated) { setStatus(null); return; }
    try { setStatus(await request()); setError(''); }
    catch { setStatus(null); }
  }, [authenticated]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function replace() {
    if (busy || !status?.canReplace) return;
    setBusy(true); setError('');
    try {
      const ready = await request();
      if (!ready.canReplace || ready.oldDrawId !== status.oldDrawId ||
          ready.newDrawId !== status.newDrawId || ready.newLedgerHash !== status.newLedgerHash ||
          ready.requestId !== status.requestId) throw new Error('開獎狀態已變更，請重新整理');
      const agreed = window.confirm(`作廢未回覆的舊輪，建立新一輪？\n\n${ready.participants} 人 · ${ready.tickets} 票 · ${ready.prizes} 個獎位\n舊請求與交易紀錄會保留；新輪只複製已鎖定帳本。\n這一步不會送出鏈上交易或自動抽獎。`);
      if (!agreed) return;
      const result = await request({ confirm: true, oldDrawId: ready.oldDrawId, newDrawId: ready.newDrawId,
        oldLedgerHash: ready.oldLedgerHash, newLedgerHash: ready.newLedgerHash,
        requestId: ready.requestId, requestTxHash: ready.requestTxHash });
      if (!result.completed) throw new Error('建立新輪失敗');
      setStatus(result); onComplete();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '建立新輪失敗';
      await refresh();
      setError(message);
    } finally { setBusy(false); }
  }
  return { canReplace: authenticated && Boolean(status?.canReplace), busy, error, replace };
}
