import { useCallback, useEffect, useState } from 'react';

type AccessState =
  | { status: 'loading' | 'locked' | 'unconfigured' | 'error' }
  | { status: 'ready'; username: string };

const ROOT = '/api/auth/surf-draw';

export function useSurfDrawAccess() {
  const [state, setState] = useState<AccessState>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) { setState({ status: 'loading' }); setError(null); }
    try {
      const response = await fetch(`${ROOT}/session`, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('surf_draw_access_unavailable');
      const result = await response.json() as { configured: boolean; authenticated: boolean; username: string | null };
      setState(!result.configured ? { status: 'unconfigured' } : result.authenticated && result.username
        ? { status: 'ready', username: result.username } : { status: 'locked' });
    } catch { setState({ status: 'error' }); }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(true); }, 60_000);
    const onVisible = () => { if (!document.hidden) void refresh(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${ROOT}/login`, { method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const result = await response.json() as { code?: string; authenticated?: boolean; username?: string };
      if (!response.ok || !result.authenticated || !result.username) {
        setError(result.code || 'surf_draw_access_unavailable');
        return false;
      }
      setState({ status: 'ready', username: result.username });
      return true;
    } catch { setError('surf_draw_access_unavailable'); return false; }
    finally { setBusy(false); }
  }, []);

  const logout = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${ROOT}/logout`, { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('surf_draw_access_unavailable');
      setState({ status: 'locked' });
    } catch { setError('surf_draw_access_unavailable'); }
    finally { setBusy(false); }
  }, []);

  return { state, busy, error, refresh, login, logout };
}
