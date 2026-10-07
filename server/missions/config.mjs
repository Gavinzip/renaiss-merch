import { getPublicOrigin } from '../config.mjs';
import { HttpError } from '../http.mjs';
import { X_MISSION_SCOPES } from './providers/x-follow.mjs';
import { DISCORD_MISSION_SCOPES } from './providers/discord-membership.mjs';
import { authEncryptionKey as missionEncryptionKey } from '../auth-secret-box.mjs';
import { isHiddenHubPath } from '../../shared/site-routes.js';
export { missionEncryptionKey };

export function providerConfig(req, provider) {
  if (!['x', 'discord'].includes(provider)) throw new HttpError(404, 'mission_not_found');
  missionEncryptionKey();
  const prefix = provider === 'x' ? 'X' : 'DISCORD';
  const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim();
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim();
  if (!clientId || !clientSecret) throw new HttpError(503, `${provider}_not_configured`);
  const origin = getPublicOrigin(req);
  const configuredCallback = process.env[`${prefix}_REDIRECT_URI`]?.trim();
  const redirectUri = configuredCallback || `${origin}/auth/${provider}/callback`;
  const callback = new URL(redirectUri);
  if (callback.origin !== origin || callback.pathname !== `/auth/${provider}/callback` || callback.search || callback.hash)
    throw new HttpError(503, `${provider}_callback_misconfigured`);
  if (process.env.NODE_ENV === 'production' && (!process.env.PUBLIC_APP_ORIGIN || callback.protocol !== 'https:'))
    throw new HttpError(503, 'mission_origin_not_configured');
  return {
    provider, clientId, clientSecret, redirectUri,
    scopes: provider === 'x' ? [...X_MISSION_SCOPES, 'offline.access'] : [...DISCORD_MISSION_SCOPES],
    authorizeUrl: provider === 'x' ? 'https://x.com/i/oauth2/authorize' : 'https://discord.com/oauth2/authorize',
    tokenUrl: provider === 'x' ? 'https://api.x.com/2/oauth2/token' : 'https://discord.com/api/oauth2/token',
  };
}

export function discordScreeningPolicy() {
  const value = process.env.SURF_DISCORD_REQUIRE_SCREENING?.trim();
  if (value !== 'true' && value !== 'false') throw new HttpError(503, 'discord_rule_not_configured');
  return value === 'true';
}

export function safeMissionReturnTo(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value))
    return '/v1.2/?preview=hub';
  const url = new URL(value, 'https://merch.invalid');
  if (url.origin !== 'https://merch.invalid' || (url.pathname !== '/' && !url.pathname.startsWith('/v1.2/') && !isHiddenHubPath(url.pathname)))
    return '/v1.2/?preview=hub';
  for (const name of ['auth', 'reason', 'mission', 'missionResult', 'missionError']) url.searchParams.delete(name);
  return `${url.pathname}${url.search}${url.hash}`;
}
