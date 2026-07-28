import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  runDatabaseBackup,
  runRepositoryCheck
} from './backup/runner.mjs';
import { loadLocalEnv } from './env-loader.mjs';
import {
  OAUTH_CHALLENGE_COOKIE,
  SESSION_COOKIE,
  clearCookie,
  parseCookies,
  setCookie
} from './cookies.mjs';
import { getAuthConfig, getPublicOrigin } from './config.mjs';
import {
  canUseDemoSession,
  createDemoUser,
  getSessionDatabaseOptions,
  isDemoAvailable,
  isDemoSession,
  requireDemoAccess
} from './demo-session.mjs';
import { handleMerchEligibility } from './eligibility.mjs';
import {
  handleMerchAccessState,
  saveMerchAccessCheck
} from './merch-access-state.mjs';
import { getMerchDatabase } from './merch-database.mjs';
import {
  canManageFulfillment,
  requireFulfillmentAdministrator
} from './fulfillment-admin.mjs';
import {
  createFulfillmentExport,
  readFulfillmentOverview
} from './fulfillment.mjs';
import { HttpError, redirect, sendHttpError, sendJson, sendNoContent } from './http.mjs';
import {
  buildAuthorizationUrl,
  createPkceChallenge,
  discoverIssuer,
  exchangeAuthorizationCode,
  randomToken,
  resolveRenaissIdentity
} from './oidc.mjs';
import {
  handleMerchShippingClaim,
  handleStoredMerchShippingClaim
} from './shipping-claims.mjs';
import {
  handleMerchShippingProfile,
  handleStoredMerchShippingProfile
} from './shipping-profile.mjs';
import { handleMerchRevealMedia } from './reveal-media.mjs';
import { handleMerchRevealThumbnail } from './reveal-thumbnail.mjs';
import { getRuntimeConfig } from './runtime-config.mjs';
import {
  CHALLENGE_MAX_AGE_SECONDS,
  SESSION_MAX_AGE_SECONDS,
  createSession,
  deleteSession,
  getSession,
  saveChallenge,
  takeChallenge
} from './session-store.mjs';
import { serveStatic } from './static.mjs';

loadLocalEnv();

const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const backupTriggerAttempts = [];
getMerchDatabase(getRuntimeConfig().databasePath);
const vite = isProduction
  ? null
  : await createDevelopmentViteServer();

const server = createServer(async (req, res) => {
  try {
    const handled = await handleRoute(req, res);

    if (handled) {
      return;
    }

    if (vite) {
      if (await serveViteHtml(req, res)) {
        return;
      }

      vite.middlewares(req, res);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    if (req.url?.startsWith('/api/') || req.url?.startsWith('/auth/')) {
      sendHttpError(res, error);
      return;
    }

    const httpError = error instanceof HttpError ? error : new HttpError(500, 'server_error');
    res.writeHead(httpError.status, {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8'
    });
    res.end(httpError.code);
  }
});

server.listen(port, host, () => {
  console.log(`renaiss-merch server listening on http://${host}:${port}`);
});

async function createDevelopmentViteServer() {
  const { createServer: createViteServer } = await import('vite');

  return createViteServer({
    appType: 'custom',
    server: {
      middlewareMode: true
    }
  });
}

async function handleRoute(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');

  if (url.pathname === '/healthz') {
    requireMethod(req, 'GET');
    sendHealthCheck(res);
    return true;
  }

  if (url.pathname === '/api/auth/renaiss/start') {
    await startRenaissLogin(req, res, url);
    return true;
  }

  if (url.pathname === '/auth/callback') {
    await finishRenaissLogin(req, res, url);
    return true;
  }

  if (url.pathname === '/api/auth/session') {
    requireMethod(req, 'GET');
    sendSession(req, res, url);
    return true;
  }

  if (url.pathname === '/api/auth/demo') {
    startDemoSession(req, res, url);
    return true;
  }

  if (url.pathname === '/api/auth/logout') {
    requireMethod(req, 'POST');
    logout(req, res);
    return true;
  }

  if (url.pathname === '/api/auth/logout-return') {
    requireMethod(req, 'GET');
    logoutAndRedirect(req, res, url);
    return true;
  }

  if (url.pathname === '/api/merch-eligibility') {
    requireMethod(req, 'GET');
    const session = readSession(req);
    const databaseOptions = getSessionDatabaseOptions(session);

    await handleMerchEligibility(
      res,
      session,
      url.searchParams.get('productId'),
      {
        onChecked: (checkedSession, result) =>
          saveMerchAccessCheck(checkedSession, result, databaseOptions)
      }
    );
    return true;
  }

  if (url.pathname === '/api/merch-access-state') {
    requireMethod(req, 'GET');
    const session = readSession(req);

    handleMerchAccessState(
      res,
      session,
      getSessionDatabaseOptions(session)
    );
    return true;
  }

  if (url.pathname === '/api/merch-reveal-media') {
    await handleMerchRevealMedia(
      req,
      res,
      readSession(req),
      url.searchParams.get('productId'),
      url.searchParams.get('direction')
    );
    return true;
  }

  if (url.pathname === '/api/merch-reveal-thumbnail') {
    await handleMerchRevealThumbnail(
      req,
      res,
      readSession(req),
      url.searchParams.get('productId'),
      url.searchParams.get('variant')
    );
    return true;
  }

  if (url.pathname === '/api/merch-shipping-claim') {
    const session = readSession(req);
    const databaseOptions = getSessionDatabaseOptions(session);

    if (req.method === 'GET') {
      handleStoredMerchShippingClaim(res, session, {
        productId: url.searchParams.get('productId'),
        readOptions: databaseOptions
      });
      return true;
    }

    requireMethod(req, 'POST');
    await handleMerchShippingClaim(req, res, session, {
      saveOptions: databaseOptions
    });
    return true;
  }

  if (url.pathname === '/api/merch-shipping-profile') {
    const session = readSession(req);
    const databaseOptions = getSessionDatabaseOptions(session);

    if (req.method === 'GET') {
      handleStoredMerchShippingProfile(res, session, databaseOptions);
      return true;
    }

    requireMethod(req, 'PUT');
    await handleMerchShippingProfile(req, res, session, databaseOptions);
    return true;
  }

  if (url.pathname === '/api/admin/fulfillment') {
    requireMethod(req, 'GET');
    sendFulfillmentOverview(req, res);
    return true;
  }

  if (url.pathname === '/api/admin/fulfillment/export') {
    requireMethod(req, 'POST');
    exportFulfillmentRecipients(req, res);
    return true;
  }

  if (url.pathname === '/api/internal/backup') {
    requireMethod(req, 'POST');
    await triggerBackup(req, res);
    return true;
  }

  if (url.pathname === '/api/internal/backup/check') {
    requireMethod(req, 'POST');
    await checkBackupRepository(req, res);
    return true;
  }

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    throw new HttpError(404, 'not_found');
  }

  return false;
}

async function serveViteHtml(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }

  const url = new URL(req.url || '/', 'http://localhost');

  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    isViteDevRequestPath(url.pathname) ||
    (!isVersionedAppRoute(url.pathname) && /\.[^/]+$/.test(url.pathname))
  ) {
    return false;
  }

  const previewName = url.searchParams.get('preview');
  const templatePath =
    previewName === 'tshirt-physics' || previewName === 'bracelets'
      ? '../dev-preview.html'
      : isVersionedAppRoute(url.pathname)
        ? '../v1.2/index.html'
        : '../index.html';
  const template = await readFile(
    fileURLToPath(new URL(templatePath, import.meta.url)),
    'utf8'
  );
  const html = await vite.transformIndexHtml(url.pathname, template);

  res.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/html; charset=utf-8'
  });

  if (req.method === 'HEAD') {
    res.end();
  } else {
    res.end(html);
  }

  return true;
}

function isViteDevRequestPath(pathname) {
  return (
    pathname.startsWith('/@') ||
    pathname.startsWith('/node_modules/') ||
    pathname === '/__vite_ping'
  );
}

function isVersionedAppRoute(pathname) {
  return pathname === '/v1.2' || pathname.startsWith('/v1.2/');
}

function sendHealthCheck(res) {
  const config = getRuntimeConfig();

  sendJson(res, 200, {
    ok: true,
    service: 'renaiss-merch',
    database: {
      path: config.databasePath,
      state: config.databasePath.startsWith('/data/') ? 'persistent' : 'local'
    },
    backup: {
      state: config.backup.state
    },
    checkedAt: new Date().toISOString()
  });
}

async function triggerBackup(req, res) {
  const config = getRuntimeConfig();
  requireBackupTrigger(req, config);

  try {
    const result = await runDatabaseBackup(config);
    sendJson(res, 200, {
      ok: true,
      ...result
    });
  } catch (error) {
    throw backupHttpError(error, 'backup_failed');
  }
}

async function checkBackupRepository(req, res) {
  const config = getRuntimeConfig();
  requireBackupTrigger(req, config);

  try {
    const result = await runRepositoryCheck(config);
    sendJson(res, 200, {
      ok: true,
      ...result
    });
  } catch (error) {
    throw backupHttpError(error, 'backup_check_failed');
  }
}

async function startRenaissLogin(req, res, url) {
  const returnTo = safeReturnTo(url.searchParams.get('returnTo'));

  try {
    requireMethod(req, 'GET');

    const config = getAuthConfig(req);
    const discovery = await discoverIssuer(config.issuer);
    const pkce = createPkceChallenge();
    const challenge = {
      ...pkce,
      nonce: randomToken(),
      redirectUri: config.redirectUri,
      returnTo,
      state: randomToken()
    };
    const challengeId = saveChallenge(challenge);
    const authorizationUrl = buildAuthorizationUrl(discovery, config, challenge);

    setCookie(req, res, OAUTH_CHALLENGE_COOKIE, challengeId, {
      maxAge: CHALLENGE_MAX_AGE_SECONDS
    });
    redirect(res, authorizationUrl);
  } catch (error) {
    logRenaissAuthFailure('start', error);
    redirect(res, authErrorLocation(error, returnTo));
  }
}

async function finishRenaissLogin(req, res, url) {
  let returnTo = '/';

  try {
    requireMethod(req, 'GET');

    if (url.searchParams.get('error')) {
      throw new HttpError(401, 'sso_authorization_failed');
    }

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const challengeId = parseCookies(req).get(OAUTH_CHALLENGE_COOKIE);
    const challenge = takeChallenge(challengeId);
    returnTo = safeReturnTo(challenge?.returnTo);

    clearCookie(req, res, OAUTH_CHALLENGE_COOKIE);

    if (!code || !state || !challenge || challenge.state !== state) {
      throw new HttpError(401, 'invalid_oauth_state');
    }

    const config = getAuthConfig(req);
    const discovery = await discoverIssuer(config.issuer);
    const tokens = await exchangeAuthorizationCode(discovery, config, challenge, code);
    const user = await resolveRenaissIdentity(discovery, config, challenge, tokens);
    const { id } = createSession(user);

    setCookie(req, res, SESSION_COOKIE, id, {
      maxAge: SESSION_MAX_AGE_SECONDS
    });
    redirect(res, authReturnLocation(returnTo, 'success'));
  } catch (error) {
    clearCookie(req, res, OAUTH_CHALLENGE_COOKIE);
    logRenaissAuthFailure('callback', error);
    redirect(res, authErrorLocation(error, returnTo));
  }
}

function sendSession(req, res, url) {
  const session = readSession(req);
  const demoAvailable = isDemoAvailable(
    req,
    isProduction,
    url.searchParams.get('surface')
  );

  if (!session) {
    sendJson(res, 200, {
      authenticated: false,
      demoAvailable
    });
    return;
  }

  sendAuthenticatedSession(res, session, demoAvailable);
}

function startDemoSession(req, res, url) {
  requireMethod(req, 'POST');
  requireDemoAccess(
    req,
    isProduction,
    url.searchParams.get('surface')
  );
  requireSameOrigin(req);
  deleteCurrentSession(req);

  const mode =
    url.searchParams.get('mode') === 'unqualified'
      ? 'unqualified'
      : 'eligible';
  const { id, session } = createSession(createDemoUser(mode));
  setCookie(req, res, SESSION_COOKIE, id, {
    maxAge: SESSION_MAX_AGE_SECONDS
  });
  sendAuthenticatedSession(res, session, true);
}

function sendAuthenticatedSession(res, session, demoAvailable) {
  const { demoSbtBalance: _demoSbtBalance, ...publicUser } = session.user;

  sendJson(res, 200, {
    authenticated: true,
    demoAvailable,
    user: {
      ...publicUser,
      canManageFulfillment: canManageFulfillment(session)
    }
  });
}

function sendFulfillmentOverview(req, res) {
  requireFulfillmentAdministrator(readSession(req));
  sendJson(res, 200, readFulfillmentOverview());
}

function exportFulfillmentRecipients(req, res) {
  const session = readSession(req);
  requireFulfillmentAdministrator(session);
  requireSameOrigin(req);

  const { csv, exportRecord } = createFulfillmentExport();
  const body = Buffer.from(csv, 'utf8');
  const timestamp = exportRecord.createdAt.replace(/[:.]/g, '-');

  res.writeHead(200, {
    'Cache-Control': 'no-store, private',
    'Content-Disposition': `attachment; filename="renaiss-merch-fulfillment-${timestamp}.csv"`,
    'Content-Length': body.byteLength,
    'Content-Type': 'text/csv; charset=utf-8',
    'X-Fulfillment-Export-Count': String(exportRecord.recipientCount),
    'X-Fulfillment-Exported-At': exportRecord.createdAt
  });
  res.end(body);
}

function logout(req, res) {
  clearSession(req, res);
  sendNoContent(res);
}

function logoutAndRedirect(req, res, url) {
  clearSession(req, res);
  redirect(res, safeReturnTo(url.searchParams.get('returnTo')));
}

function clearSession(req, res) {
  deleteCurrentSession(req);
  clearCookie(req, res, SESSION_COOKIE);
}

function deleteCurrentSession(req) {
  deleteSession(parseCookies(req).get(SESSION_COOKIE));
}

function readSession(req) {
  const session = getSession(parseCookies(req).get(SESSION_COOKIE));

  if (
    isDemoSession(session) &&
    !canUseDemoSession(req, isProduction)
  ) {
    return null;
  }

  return session;
}

function requireMethod(req, method) {
  if (req.method !== method) {
    throw new HttpError(405, 'method_not_allowed');
  }
}

function requireSameOrigin(req) {
  const origin = req.headers.origin;

  if (typeof origin !== 'string' || origin !== getPublicOrigin(req)) {
    throw new HttpError(403, 'invalid_request_origin');
  }
}

function requireBackupTrigger(req, config) {
  if (!config.backup.configured) {
    throw new HttpError(503, `backup_${config.backup.state}`);
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token || !constantTimeEqual(token, config.backup.triggerSecret)) {
    throw new HttpError(401, 'backup_trigger_unauthorized');
  }

  recordBackupTriggerAttempt();
}

function recordBackupTriggerAttempt() {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;

  while (backupTriggerAttempts.length && backupTriggerAttempts[0] < now - windowMs) {
    backupTriggerAttempts.shift();
  }

  if (backupTriggerAttempts.length >= 6) {
    throw new HttpError(429, 'backup_trigger_rate_limited');
  }

  backupTriggerAttempts.push(now);
}

function constantTimeEqual(actual, expected) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function backupHttpError(error, fallbackCode) {
  if (error?.code === 'backup_in_progress') {
    return new HttpError(409, 'backup_in_progress');
  }

  console.error('Backup operation failed:', sanitizeLogMessage(error?.message));
  return new HttpError(502, fallbackCode);
}

function sanitizeLogMessage(message) {
  return String(message || 'unknown_error').replace(/[A-Za-z0-9_./+=:-]{24,}/g, '[redacted]');
}

function authErrorLocation(error, returnTo = '/') {
  const httpError = error instanceof HttpError ? error : new HttpError(500, 'server_error');

  return authReturnLocation(returnTo, 'error', httpError.code);
}

function logRenaissAuthFailure(stage, error) {
  const code = error instanceof HttpError ? error.code : 'server_error';

  console.warn('Renaiss SSO failed:', { stage, code });
}

function authReturnLocation(returnTo, authState, reason) {
  const target = new URL(safeReturnTo(returnTo), 'http://localhost');
  target.searchParams.set('auth', authState);

  if (reason) {
    target.searchParams.set('reason', reason);
  }

  return `${target.pathname}${target.search}${target.hash}`;
}

function safeReturnTo(returnTo) {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return '/';
  }

  return returnTo;
}
