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
