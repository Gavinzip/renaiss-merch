import { useCallback, useEffect, useState } from 'react';

export type SocialProvider = 'x' | 'discord';
export type MissionResult = {
  outcome: 'verified' | 'incomplete' | 'pending' | 'unavailable' | 'reauthorize';
  reason?: string; checkedAt?: string; stale?: boolean; retryAfterSeconds?: number;
};
export type SocialTaskState = {
  configured: boolean; configurationReason: string | null;
  identityLocked: boolean;
  connection: { username: string; userId: string } | null; result: MissionResult | null;
};
export type RecordedMissionTask = {
  verified: boolean; verifiedAt: string | null; checkedAt: string | null;
  outcome: MissionResult['outcome']; reason: string | null;
};
export type SurfParticipation = {
  campaignId: string; ruleVersion: string; userSub: string; name: string | null;
  walletAddress: string | null; email: string | null; renaissXUsername: string | null;
  xUserId: string | null; xUsername: string | null; discordUserId: string | null; discordUsername: string | null;
  ticketCount: number; status: 'eligible' | 'wallet_required' | 'accounts_required' | 'wallet_already_registered';
  tasks: Record<'accounts' | SocialProvider, RecordedMissionTask>;
  createdAt: string; updatedAt: string;
};
export type SurfMissionState = {
  authenticated: boolean; demo: boolean; entries: number | null;
  accounts: MissionResult & { configured: boolean; email?: string; emailLinked?: boolean };
  providers: Record<SocialProvider, SocialTaskState>;
  participation: SurfParticipation | null;
};

class MissionRequestError extends Error { constructor(public code: string) { super(code); } }
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) }, cache: 'no-store', signal: AbortSignal.timeout(120_000) });
  const body = await response.json();
  if (!response.ok) throw new MissionRequestError(typeof body.code === 'string' ? body.code : 'mission_verification_failed');
  return body as T;
}

export function useSurfMissions(active: boolean, userSub: string | null) {
  const [state, setState] = useState<SurfMissionState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<SocialProvider | 'accounts' | null>(null);
  const [error, setError] = useState<string | null>(() => new URL(location.href).searchParams.get('missionError'));
  const [resume] = useState(() => ['x', 'discord', 'resume'].includes(new URL(location.href).searchParams.get('mission') || ''));
  const [retry, setRetry] = useState(0);
  const reload = useCallback(() => { setError(null); setRetry(n => n + 1); }, []);
  useEffect(() => {
    if (!active) { setState(null); return; }
    let cancelled = false; setLoading(true);
    void (async () => {
      try {
        const value = await request<SurfMissionState>('/api/missions/surf');
        if (cancelled) return;
        setState(value);
        if (value.authenticated && !value.participation?.tasks.accounts.verified && value.accounts.configured && value.accounts.emailLinked &&
            (value.accounts.outcome === 'pending' || value.accounts.stale)) {
          setBusy('accounts');
          const checked = await request<SurfMissionState>('/api/missions/surf/accounts/verify', { method: 'POST' });
          if (!cancelled) setState(checked);
        }
      } catch (error) {
        if (!cancelled) setError(error instanceof MissionRequestError ? error.code : 'mission_state_unavailable');
      } finally {
        if (!cancelled) { setLoading(false); setBusy(null); }
      }
    })();
    return () => { cancelled = true; };
  }, [active, userSub, retry]);
  useEffect(() => {
    if (!resume) return;
    const url = new URL(location.href);
    for (const key of ['mission', 'missionResult', 'missionError']) url.searchParams.delete(key);
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [resume]);
  async function act(provider: SocialProvider, action: 'connect' | 'verify') {
    if (busy) return;
    setBusy(provider); setError(null);
    try {
      const url = new URL(`/api/missions/surf/${provider}/${action}`, location.origin);
      if (action === 'connect') url.searchParams.set('returnTo', `${location.pathname}${location.search}${location.hash}`);
      if (action === 'connect') {
        const result = await request<{ authorizationUrl: string }>(`${url.pathname}${url.search}`, { method: 'POST' });
        const destination = new URL(result.authorizationUrl);
        const expected = provider === 'x' ? 'https://x.com' : 'https://discord.com';
        if (destination.origin !== expected) throw new MissionRequestError('mission_verification_failed');
        location.assign(destination.href);
      } else setState(await request<SurfMissionState>(url.pathname, { method: 'POST' }));
    } catch (error) { setError(error instanceof MissionRequestError ? error.code : 'mission_verification_failed'); }
    finally { setBusy(null); }
  }
  async function verifyAccounts() {
    if (busy) return;
    setBusy('accounts'); setError(null);
    try { setState(await request<SurfMissionState>('/api/missions/surf/accounts/verify', { method: 'POST' })); }
    catch (error) { setError(error instanceof MissionRequestError ? error.code : 'mission_verification_failed'); }
    finally { setBusy(null); }
  }
  const currentState = state?.participation && state.participation.userSub !== userSub ? null : state;
  return { state: active ? currentState : null, loading, busy, error, resume, reload, act, verifyAccounts };
}
