import { useCallback, useEffect, useRef, useState } from 'react';

const ROOT = '/api/local/surf-operator';
export const LOCAL_SURF_DRAW_API = `${ROOT}/draw`;
const messages: Record<string, string> = {
  operator_bridge_not_deployed: '線上管理連線尚未部署',
  operator_upstream_unavailable: '目前無法連接線上開獎服務',
  operator_upstream_invalid: '線上管理連線回應不正確',
  operator_connection_expired: '正式開獎連線已到期，請重新連接',
  operator_connection_required: '請先連接線上正式開獎',
};
type Connection = { connected: boolean; pending?: boolean; name?: string; code?: string };
async function request(path: string, post = false): Promise<Connection & { authorizeUrl?: string }> {
  const response = await fetch(`${ROOT}/${path}`, { method: post ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store' });
  const value = await response.json();
  if (!response.ok) throw new Error(messages[value.code] || value.code || '無法連接正式開獎');
  return value;
}

export function useLocalSurfOperator() {
  const [state, setState] = useState<Connection>({ connected: false });
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const alive = useRef(true), revision = useRef(0);
  const popup = useRef<Window | null>(null);
  const refresh = useCallback(async () => {
    const read = ++revision.current;
    try {
      const next = await request('session');
      if (!alive.current || read !== revision.current) return;
      setState(next);
      if (next.code) setError(messages[next.code] || next.code);
      else if (next.connected || next.pending) setError('');
    } catch (reason) {
      if (alive.current && read === revision.current) setError(reason instanceof Error ? reason.message : '無法連接正式開獎');
    }
  }, []);
  useEffect(() => {
    alive.current = true; void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 3000);
    return () => { alive.current = false; ++revision.current; window.clearInterval(timer); };
  }, [refresh]);

  async function connect() {
    if (busy || state.pending) { popup.current?.focus(); return; }
    // Reserve the window during the user's click so popup blocking cannot hide
    // the online login/approval page behind an asynchronous request.
    const target = window.open('about:blank', 'renaiss-surf-operator', 'popup,width=520,height=680');
    if (!target) { setError('請允許開啟管理員登入視窗'); return; }
    popup.current = target; setBusy(true); setError(''); ++revision.current;
    try {
      const result = await request('start', true);
      const url = new URL(result.authorizeUrl || '');
      if (url.origin !== 'https://merch.renaisscltb.com' || url.pathname !== '/local-draw-operator') throw new Error('管理員登入網址不正確');
      target.location.href = url.href;
      if (alive.current) setState({ connected: false, pending: true });
      await refresh();
    } catch (reason) {
      target.close();
      if (alive.current) setError(reason instanceof Error ? reason.message : '無法開始連接');
    } finally { if (alive.current) setBusy(false); }
  }
  async function disconnect() {
    if (busy) return;
    setBusy(true); ++revision.current;
    try { await request('disconnect', true); if (alive.current) { setState({ connected: false }); setError(''); } }
    catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '無法斷開連接'); }
    finally { if (alive.current) setBusy(false); }
  }
  return { connected: state.connected, pending: Boolean(state.pending), busy, connect, disconnect,
    message: error || (state.pending ? '等待線上管理員確認' : state.connected ? '已連接線上正式開獎' : '') };
}
