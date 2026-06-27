import { createServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import { loadLocalEnv } from './env-loader.mjs';
import {
  OAUTH_CHALLENGE_COOKIE,
  SESSION_COOKIE,
  clearCookie,
  parseCookies,
  setCookie
} from './cookies.mjs';
import { getAuthConfig } from './config.mjs';
import { handleMerchEligibility } from './eligibility.mjs';
import { HttpError, redirect, sendHttpError, sendJson, sendNoContent } from './http.mjs';
import {
  buildAuthorizationUrl,
  createPkceChallenge,
  discoverIssuer,
  exchangeAuthorizationCode,
  randomToken,
  resolveRenaissIdentity
} from './oidc.mjs';
import { handleMerchShippingClaim } from './shipping-claims.mjs';
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
      vite.middlewares(req, res);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    if (req.url?.startsWith('/api/')) {
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
    requireMethod(req, 'POST');
    await handleMerchShippingClaim(req, res, readSession(req));
    return true;
  }

  return false;
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
    user: session.user
  });
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
