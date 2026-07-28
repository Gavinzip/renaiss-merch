import { randomBytes } from 'node:crypto';
import { HttpError } from './http.mjs';

export const DEMO_DATABASE_PATH = '.data/merch-demo.sqlite';

export function createLocalDemoUser(mode = 'eligible') {
  const isUnqualified = mode === 'unqualified';

  return {
    chainId: '56',
    demoSbtBalance: isUnqualified ? 64 : 120,
    email: 'demo.member@renaiss.local',
    emailVerified: true,
    isDemo: true,
    legacyWalletAddress: null,
    name: 'Demo Member',
    picture: null,
    safeWalletAddress: `0x${randomBytes(20).toString('hex')}`,
    sub: 'local-demo-member',
    twitterUsername: 'renaiss_demo'
  };
}

export function getSessionDatabaseOptions(session) {
  return isLocalDemoSession(session)
    ? { dbPath: DEMO_DATABASE_PATH }
    : {};
}

export function isLocalDemoAvailable(req, isProduction) {
  return !isProduction && isLoopbackRequest(req) && isLocalHost(req);
}

export function isLocalDemoSession(session) {
  return session?.user?.isDemo === true;
}

export function requireLocalDemoAccess(req, isProduction) {
  if (!isLocalDemoAvailable(req, isProduction)) {
    throw new HttpError(404, 'not_found');
  }
}

function isLoopbackRequest(req) {
  const remoteAddress = req.socket?.remoteAddress || '';

  return (
    remoteAddress === '127.0.0.1' ||
    remoteAddress === '::1' ||
    remoteAddress === '::ffff:127.0.0.1'
  );
}

function isLocalHost(req) {
  const hostHeader = req.headers.host;

  if (typeof hostHeader !== 'string' || !hostHeader.trim()) {
    return false;
  }

  try {
    const hostname = new URL(`http://${hostHeader}`).hostname;
    return (
      hostname === '127.0.0.1' ||
      hostname === 'localhost' ||
      hostname === '[::1]'
    );
  } catch {
    return false;
  }
}
