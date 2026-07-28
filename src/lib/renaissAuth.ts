export type RenaissUser = {
  sub: string;
  name: string | null;
  picture: string | null;
  email: string | null;
  emailVerified: boolean;
  safeWalletAddress: string | null;
  legacyWalletAddress: string | null;
  chainId: string | null;
  twitterUsername: string | null;
  canManageFulfillment: boolean;
  isDemo?: boolean;
};

export type RenaissSession =
  | {
      authenticated: false;
      demoAvailable?: boolean;
    }
  | {
      authenticated: true;
      demoAvailable?: boolean;
      user: RenaissUser;
    };

export async function readRenaissSession(): Promise<RenaissSession> {
  const endpoint = new URL('/api/auth/session', window.location.origin);
  endpoint.searchParams.set('surface', 'v1.2');
  const response = await fetch(`${endpoint.pathname}${endpoint.search}`, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Session endpoint returned ${response.status}.`);
  }

  return (await response.json()) as RenaissSession;
}

export function startRenaissLogin() {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const loginUrl = new URL('/api/auth/renaiss/start', window.location.origin);
  loginUrl.searchParams.set('returnTo', returnTo);
  window.location.assign(`${loginUrl.pathname}${loginUrl.search}`);
}

export function readRenaissLogoutReturnUrl() {
  const returnTo = `${window.location.pathname}${window.location.hash}`;
  const logoutUrl = new URL('/api/auth/logout-return', window.location.origin);
  logoutUrl.searchParams.set('returnTo', returnTo);

  return `${logoutUrl.pathname}${logoutUrl.search}`;
}

export async function signOutRenaiss() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(`Logout endpoint returned ${response.status}.`);
  }
}

export async function startDemoRenaissSession(
  mode: 'eligible' | 'unqualified' = 'eligible'
): Promise<RenaissSession> {
  const endpoint = new URL('/api/auth/demo', window.location.origin);
  endpoint.searchParams.set('surface', 'v1.2');

  if (mode === 'unqualified') {
    endpoint.searchParams.set('mode', mode);
  }

  const response = await fetch(`${endpoint.pathname}${endpoint.search}`, {
    method: 'POST',
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Demo session endpoint returned ${response.status}.`);
  }

  return (await response.json()) as RenaissSession;
}
