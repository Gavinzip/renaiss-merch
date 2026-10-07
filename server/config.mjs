import { HttpError } from './http.mjs';

const DEFAULT_RENAISS_ISSUER = 'https://www.renaiss.xyz/api/auth';
const DEFAULT_RENAISS_SCOPE = 'openid profile email safe x';
const DEFAULT_TOKEN_AUTH_METHOD = 'post';

export function getAuthConfig(req) {
  const origin = getPublicOrigin(req);
  const issuer = trimTrailingSlash(
    process.env.RENAISS_ISSUER || DEFAULT_RENAISS_ISSUER
  );
  const clientId = readOptionalEnv('RENAISS_CLIENT_ID');
  const clientSecret = readOptionalEnv('RENAISS_CLIENT_SECRET');
  const redirectUri =
    readOptionalEnv('RENAISS_REDIRECT_URI') || `${origin}/auth/callback`;
  const scope = readOptionalEnv('RENAISS_SCOPE') || DEFAULT_RENAISS_SCOPE;
  const tokenAuthMethod =
    readOptionalEnv('RENAISS_TOKEN_AUTH_METHOD') || DEFAULT_TOKEN_AUTH_METHOD;

  if (!clientId || !clientSecret) {
    throw new HttpError(500, 'sso_not_configured');
  }

  if (tokenAuthMethod !== 'post') {
    throw new HttpError(500, 'unsupported_token_auth_method');
  }

  return {
    clientId,
    clientSecret,
    issuer,
    origin,
    redirectUri,
    scope,
    tokenAuthMethod
  };
}

export function getPublicOrigin(req) {
  const configuredOrigin = readOptionalEnv('PUBLIC_APP_ORIGIN');

  if (configuredOrigin) {
    return trimTrailingSlash(configuredOrigin);
  }

  const host = firstHeaderValue(req.headers['x-forwarded-host']) || req.headers.host;
  const proto =
    firstHeaderValue(req.headers['x-forwarded-proto']) ||
    (req.socket.encrypted ? 'https' : 'http');

  if (!host) {
    throw new HttpError(500, 'public_origin_unavailable');
  }

  return trimTrailingSlash(`${proto}://${host}`);
}

// The Renaiss development callback is allowlisted for localhost. Redirect the
// start request before writing the challenge cookie so the callback can read it.
export function developmentLoginLocation(req, url) {
  const value = process.env.DEV_RENAISS_LOGIN_ORIGIN?.trim();
  if (process.env.NODE_ENV === 'production' || !value) return null;
  const target = new URL(value);
  if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.protocol !== 'http:' ||
      target.pathname !== '/' || target.search || target.hash)
    throw new HttpError(500, 'development_login_origin_invalid');
  const current = new URL(getPublicOrigin(req));
  if (!['localhost', '127.0.0.1'].includes(current.hostname))
    throw new HttpError(500, 'development_login_origin_invalid');
  return current.origin === target.origin ? null : `${target.origin}${url.pathname}${url.search}`;
}

function readOptionalEnv(name) {
  const value = process.env[name]?.trim();

  return value || '';
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0]?.split(',')[0]?.trim();
  }

  return value?.split(',')[0]?.trim();
}
