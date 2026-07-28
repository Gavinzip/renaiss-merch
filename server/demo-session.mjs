import { randomBytes } from 'node:crypto';
import { getPublicOrigin } from './config.mjs';
import { HttpError } from './http.mjs';
import { isProductionStorefrontMode } from './storefront-mode.mjs';

export const DEMO_DATABASE_PATH = '.data/merch-demo.sqlite';
const TEMPORARY_DEMO_ENV = 'MERCH_V12_DEMO_ENABLED';
const VERSIONED_DEMO_SURFACE = 'v1.2';

export function createDemoUser(mode = 'eligible') {
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
  return isDemoSession(session)
    ? { dbPath: DEMO_DATABASE_PATH }
    : {};
}

export function isDemoAvailable(req, isProduction, surface) {
  if (isProductionStorefrontMode()) {
    return false;
  }

  if (!isProduction) {
    return isLoopbackRequest(req) && isLocalHost(req);
  }

  return (
    isTemporaryDemoEnabled() &&
    surface === VERSIONED_DEMO_SURFACE &&
    isVersionedDemoRequest(req)
  );
}

export function isDemoSession(session) {
  return session?.user?.isDemo === true;
}

export function canUseDemoSession(req, isProduction) {
  if (isProductionStorefrontMode()) {
    return false;
  }

  if (!isProduction) {
    return isLoopbackRequest(req) && isLocalHost(req);
  }

  return isTemporaryDemoEnabled() && isVersionedDemoRequest(req);
}

export function requireDemoAccess(req, isProduction, surface) {
  if (!isDemoAvailable(req, isProduction, surface)) {
    throw new HttpError(404, 'not_found');
  }
}

function isTemporaryDemoEnabled() {
  return process.env[TEMPORARY_DEMO_ENV]?.trim().toLowerCase() === 'true';
}

function isVersionedDemoRequest(req) {
  const referer = req.headers.referer;

  if (typeof referer !== 'string' || !referer.trim()) {
    return false;
  }

  try {
    const refererUrl = new URL(referer);
    return (
      refererUrl.origin === getPublicOrigin(req) &&
      (refererUrl.pathname === '/v1.2' ||
        refererUrl.pathname.startsWith('/v1.2/'))
    );
  } catch {
    return false;
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
