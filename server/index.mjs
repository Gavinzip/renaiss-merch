import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
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
import { handleMerchEligibility } from './eligibility.mjs';
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
const vite = isProduction
  ? null
  : await createViteServer({
      appType: 'custom',
      server: {
        middlewareMode: true
      }
    });

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

async function handleRoute(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');

  if (url.pathname === '/healthz') {
    requireMethod(req, 'GET');
    sendHealthCheck(res);
    return true;
  }

  if (url.pathname === '/api/auth/renaiss/start') {
    await startRenaissLogin(req, res);
    return true;
  }

  if (url.pathname === '/auth/callback') {
    await finishRenaissLogin(req, res, url);
    return true;
  }

  if (url.pathname === '/api/auth/session') {
    requireMethod(req, 'GET');
    sendSession(req, res);
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
    await handleMerchEligibility(res, readSession(req));
    return true;
  }

  if (url.pathname === '/api/merch-shipping-claim') {
    if (req.method === 'GET') {
      handleStoredMerchShippingClaim(res, readSession(req));
      return true;
    }

    requireMethod(req, 'POST');
    await handleMerchShippingClaim(req, res, readSession(req));
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
    /\.[^/]+$/.test(url.pathname)
  ) {
    return false;
  }

  const template = await readFile(
    fileURLToPath(new URL('../index.html', import.meta.url)),
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

async function startRenaissLogin(req, res) {
  try {
    requireMethod(req, 'GET');

    const config = getAuthConfig(req);
    const discovery = await discoverIssuer(config.issuer);
    const pkce = createPkceChallenge();
    const challenge = {
      ...pkce,
      nonce: randomToken(),
      redirectUri: config.redirectUri,
      state: randomToken()
    };
    const challengeId = saveChallenge(challenge);
    const authorizationUrl = buildAuthorizationUrl(discovery, config, challenge);

    setCookie(req, res, OAUTH_CHALLENGE_COOKIE, challengeId, {
      maxAge: CHALLENGE_MAX_AGE_SECONDS
    });
    redirect(res, authorizationUrl);
  } catch (error) {
    redirect(res, authErrorLocation(error));
  }
}

async function finishRenaissLogin(req, res, url) {
  try {
    requireMethod(req, 'GET');

    if (url.searchParams.get('error')) {
      throw new HttpError(401, 'sso_authorization_failed');
    }

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const challengeId = parseCookies(req).get(OAUTH_CHALLENGE_COOKIE);
    const challenge = takeChallenge(challengeId);

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
    redirect(res, '/?auth=success');
  } catch (error) {
    clearCookie(req, res, OAUTH_CHALLENGE_COOKIE);
    redirect(res, authErrorLocation(error));
  }
}

function sendSession(req, res) {
  const session = readSession(req);

  if (!session) {
    sendJson(res, 200, {
      authenticated: false
    });
    return;
  }

  sendJson(res, 200, {
    authenticated: true,
    user: {
      ...session.user,
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
  const sessionId = parseCookies(req).get(SESSION_COOKIE);
  deleteSession(sessionId);
  clearCookie(req, res, SESSION_COOKIE);
}

function readSession(req) {
  return getSession(parseCookies(req).get(SESSION_COOKIE));
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

function authErrorLocation(error) {
  const httpError = error instanceof HttpError ? error : new HttpError(500, 'server_error');
  const reason = encodeURIComponent(httpError.code);

  return `/?auth=error&reason=${reason}`;
}

function safeReturnTo(returnTo) {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return '/';
  }

  return returnTo;
}
