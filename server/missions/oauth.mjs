import { HttpError } from '../http.mjs';
import { requestProviderJson } from './providers/request.mjs';

export async function exchangeMissionToken(config, parameters, { fetchImpl = fetch } = {}) {
  let response, body;
  try {
    response = await fetchImpl(config.tokenUrl, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`).toString('base64')}` },
      body: new URLSearchParams({ ...parameters, client_id: config.clientId }),
    });
    body = await response.json();
  } catch { throw new HttpError(502, 'social_token_exchange_unavailable'); }
  if (!response.ok) throw new HttpError(response.status === 429 ? 429 : 401,
    response.status === 429 ? 'provider_rate_limited' : 'social_authorization_failed');
  if (body.token_type?.toLowerCase() !== 'bearer' || typeof body.access_token !== 'string' || !body.access_token ||
      typeof body.expires_in !== 'number' || !Number.isFinite(body.expires_in) || body.expires_in <= 0 ||
      typeof body.scope !== 'string' || !config.scopes.filter(s => s !== 'offline.access').every(s => body.scope.split(/\s+/).includes(s)))
    throw new HttpError(502, 'invalid_social_token_response');
  return {
    accessToken: body.access_token, refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
    scopes: body.scope.split(/\s+/), expiresAt: Date.now() + body.expires_in * 1000,
  };
}

export async function readSocialIdentity(provider, accessToken, options = {}) {
  const response = await requestProviderJson(provider === 'x' ? 'https://api.x.com/2/users/me?user.fields=username' : 'https://discord.com/api/v10/users/@me', accessToken, options);
  if (response.error) throw new HttpError(502, response.error.reason);
  if (response.body.errors !== undefined) throw new HttpError(502, 'invalid_identity_response');
  const user = provider === 'x' ? response.body.data : response.body;
  if (typeof user?.id !== 'string' || !/^\d+$/.test(user.id) || typeof user.username !== 'string' || !user.username || user.bot === true)
    throw new HttpError(502, 'invalid_identity_response');
  return { userId: user.id, username: user.username };
}

export function assertLinkedX(user, username) {
  if (!user.twitterUsername) throw new HttpError(409, 'renaiss_x_not_linked');
  const normalize = value => value.replace(/^@/, '').toLowerCase();
  if (normalize(user.twitterUsername) !== normalize(username)) throw new HttpError(409, 'renaiss_x_mismatch');
}
