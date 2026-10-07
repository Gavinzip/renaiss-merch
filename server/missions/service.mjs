import { surfCampaign } from '../../shared/surf-campaign.js';
import { HttpError } from '../http.mjs';
import { providerConfig, discordScreeningPolicy } from './config.mjs';
import { exchangeMissionToken, assertLinkedX } from './oauth.mjs';
import { createMissionStore } from './store.mjs';
import { verifyXFollow } from './providers/x-follow.mjs';
import { verifyDiscordMembership } from './providers/discord-membership.mjs';
import { readAccountsState, missionEntries } from './accounts.mjs';

export function requireMissionUser(session) {
  if (!session?.user?.sub) throw new HttpError(401, 'unauthenticated');
  if (session.user.isDemo) throw new HttpError(403, 'demo_missions_disabled');
  return session.user;
}

export function readMissionState(req, session, { storeFactory = createMissionStore } = {}) {
  const authenticated = Boolean(session?.user?.sub && !session.user.isDemo);
  const providers = {};
  for (const provider of ['x', 'discord']) {
    let configured = false, configurationReason = null, requireScreening = false;
    try { providerConfig(req, provider); if (provider === 'discord') requireScreening = discordScreeningPolicy(); configured = true; }
    catch (error) { configurationReason = error instanceof HttpError ? error.code : 'mission_configuration_invalid'; }
    let connection = null, result = null;
    if (authenticated && configured) {
      const store = storeFactory();
      connection = store.getConnection(surfCampaign.id, session.user.sub, provider);
      result = store.getResult(surfCampaign.id, session.user.sub, provider);
      if (provider === 'discord' && result && result.screeningRequired !== requireScreening) result = null;
      if (connection && provider === 'x') {
        try { assertLinkedX(session.user, connection.username); }
        catch (error) { result = { outcome: 'reauthorize', reason: error.code }; }
      }
    }
    providers[provider] = {
      configured, configurationReason,
      connection: connection ? { username: connection.username, userId: connection.userId } : null,
      result,
    };
  }
  const accounts = readAccountsState(session?.user, { storeFactory });
  return { campaignId: surfCampaign.id, authenticated, demo: session?.user?.isDemo === true,
    // This is a current task tally, not an issued ticket or reward entitlement.
    accounts, entries: missionEntries(accounts, providers), providers };
}

export async function checkMission(req, session, provider, { store = createMissionStore(), fetchImpl = fetch, connectionToSave } = {}) {
  const user = requireMissionUser(session), config = providerConfig(req, provider);
  const requireScreening = provider === 'discord' ? discordScreeningPolicy() : false;
  const release = store.acquire(surfCampaign.id, user.sub, provider);
  try {
    if (connectionToSave) store.saveConnection(surfCampaign.id, user.sub, provider, connectionToSave);
    let connection = store.getConnection(surfCampaign.id, user.sub, provider);
    let result;
    if (connection && connection.expiresAt <= Date.now() + 30_000) {
      if (!connection.refreshToken) result = { outcome: 'reauthorize', reason: 'authorization_expired' };
      else {
        try {
          const tokens = await exchangeMissionToken(config, { grant_type: 'refresh_token', refresh_token: connection.refreshToken }, { fetchImpl });
          connection = { ...connection, ...tokens, refreshToken: tokens.refreshToken || connection.refreshToken };
          store.saveConnection(surfCampaign.id, user.sub, provider, connection);
        } catch (error) {
          result = { outcome: error.status === 401 ? 'reauthorize' : 'unavailable', reason: error.code };
        }
      }
    }
    if (!result) result = provider === 'x'
      ? await verifyXFollow({ connection, targetUserId: surfCampaign.xUserId, expectedUsername: user.twitterUsername || '', fetchImpl })
      : await verifyDiscordMembership({ connection, guildId: surfCampaign.discordGuildId, inviteUrl: surfCampaign.discordUrl, requireScreening, fetchImpl });
    result = { provider, ...(provider === 'discord' ? { screeningRequired: requireScreening } : {}), targetId: provider === 'x' ? surfCampaign.xUserId : surfCampaign.discordGuildId,
      checkedAt: new Date().toISOString(), ...result };
    // A failed recheck replaces the previous pass; historical success cannot act as a current entitlement.
    store.saveResult(surfCampaign.id, user.sub, provider, result);
    return readMissionState(req, session, { storeFactory: () => store });
  } finally { release(); }
}
