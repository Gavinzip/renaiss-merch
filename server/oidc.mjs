import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { HttpError } from './http.mjs';

const discoveryCache = new Map();
const jwksCache = new Map();
const DISCOVERY_TTL_MS = 5 * 60 * 1000;
const walletPattern = /^0x[a-fA-F0-9]{40}$/;

export async function discoverIssuer(issuer) {
  const cached = discoveryCache.get(issuer);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.discovery;
  }

  const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new HttpError(502, 'sso_discovery_failed');
  }

  const discovery = await response.json();

  requireString(discovery.issuer, 'issuer');
  requireString(discovery.authorization_endpoint, 'authorization_endpoint');
  requireString(discovery.token_endpoint, 'token_endpoint');
  requireString(discovery.jwks_uri, 'jwks_uri');

  discoveryCache.set(issuer, {
    discovery,
    expiresAt: Date.now() + DISCOVERY_TTL_MS
  });

  return discovery;
}

export function createPkceChallenge() {
  const codeVerifier = randomToken(48);
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return {
    codeChallenge,
    codeVerifier
  };
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function buildAuthorizationUrl(discovery, config, challenge) {
  const authorizeUrl = new URL(discovery.authorization_endpoint);

  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizeUrl.searchParams.set('scope', config.scope);
  authorizeUrl.searchParams.set('state', challenge.state);
  authorizeUrl.searchParams.set('nonce', challenge.nonce);
  authorizeUrl.searchParams.set('code_challenge', challenge.codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('prompt', 'consent');

  return authorizeUrl.toString();
}

export async function exchangeAuthorizationCode(discovery, config, challenge, code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: challenge.codeVerifier,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: challenge.redirectUri
  });

  const response = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    throw new HttpError(502, 'token_exchange_failed');
  }

  const tokens = await response.json();

  if (!tokens.id_token || typeof tokens.id_token !== 'string') {
    throw new HttpError(502, 'id_token_missing');
  }

  return tokens;
}

export async function resolveRenaissIdentity(discovery, config, challenge, tokens) {
  const jwks = getJwks(discovery.jwks_uri);
  const { payload } = await jwtVerify(tokens.id_token, jwks, {
    audience: config.clientId,
    issuer: discovery.issuer
  });

  if (payload.nonce !== challenge.nonce) {
    throw new HttpError(401, 'invalid_nonce');
  }

  let claims = payload;

  if (tokens.access_token && discovery.userinfo_endpoint) {
    const userinfo = await fetchUserinfo(discovery.userinfo_endpoint, tokens.access_token);

    if (userinfo.sub && payload.sub && userinfo.sub !== payload.sub) {
      throw new HttpError(401, 'userinfo_subject_mismatch');
    }

    claims = {
      ...payload,
      ...userinfo
    };
  }

  return normalizeClaims(claims);
}

function getJwks(jwksUri) {
  const cached = jwksCache.get(jwksUri);

  if (cached) {
    return cached;
  }

  const jwks = createRemoteJWKSet(new URL(jwksUri));
  jwksCache.set(jwksUri, jwks);

  return jwks;
}

async function fetchUserinfo(userinfoEndpoint, accessToken) {
  const response = await fetch(userinfoEndpoint, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new HttpError(502, 'userinfo_fetch_failed');
  }

  return response.json();
}

function normalizeClaims(claims) {
  const sub = optionalString(claims.sub);

  if (!sub) {
    throw new HttpError(502, 'identity_subject_missing');
  }

  return {
    sub,
    name: optionalString(claims.name),
    picture: optionalString(claims.picture),
    email: normalizeEmail(claims.email),
    emailVerified: claims.email_verified === true,
    safeWalletAddress: normalizeWalletClaim(claims.safe_wallet_address, 'safe_wallet_address'),
    legacyWalletAddress: normalizeWalletClaim(
      claims.legacy_wallet_address,
      'legacy_wallet_address'
    ),
    chainId:
      claims.chain_id === undefined || claims.chain_id === null
        ? null
        : String(claims.chain_id),
    twitterUsername: normalizeTwitterUsername(claims.twitter_username)
  };
}

function normalizeWalletClaim(value, claimName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string' || !walletPattern.test(value)) {
    throw new HttpError(502, `${claimName}_invalid`);
  }

  return value.toLowerCase();
}

function normalizeEmail(value) {
  const email = optionalString(value);

  return email ? email.toLowerCase() : null;
}

function normalizeTwitterUsername(value) {
  const username = optionalString(value);

  return username ? username.replace(/^@/, '').toLowerCase() : null;
}

function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requireString(value, field) {
  if (typeof value !== 'string' || !value) {
    throw new HttpError(502, `discovery_${field}_missing`);
  }
}
