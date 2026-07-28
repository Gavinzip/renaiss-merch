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
};

export type RenaissSession =
  | {
      authenticated: false;
    }
  | {
      authenticated: true;
      user: RenaissUser;
    };

export async function readRenaissSession(): Promise<RenaissSession> {
  const response = await fetch('/api/auth/session', {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Session endpoint returned ${response.status}.`);
  }

  return (await response.json()) as RenaissSession;
}

export function startRenaissLogin() {
  window.location.assign('/api/auth/renaiss/start');
}

export async function signOutRenaiss() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(`Logout endpoint returned ${response.status}.`);
  }
}
