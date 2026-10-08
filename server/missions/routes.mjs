import { createHash, randomBytes } from 'node:crypto';
import { surfCampaign } from '../../shared/surf-campaign.js';
import { getPublicOrigin } from '../config.mjs';
import { parseCookies, SESSION_COOKIE, setCookie, clearCookie } from '../cookies.mjs';
import { HttpError, redirect, sendJson, sendNoContent } from '../http.mjs';
import { providerConfig, safeMissionReturnTo, discordScreeningPolicy } from './config.mjs';
import { exchangeMissionToken, readSocialIdentity, assertLinkedX } from './oauth.mjs';
import { createMissionStore } from './store.mjs';
import { checkMission, readMissionState, requireMissionUser } from './service.mjs';
import { checkAccounts } from './accounts.mjs';
import { createSurfRateStore } from './surf-rate-store.mjs';
import { createParticipationAdminHandler } from './participation-admin.mjs';

export function createMissionRouteHandler({ readSession, storeFactory = createMissionStore, rateStoreFactory = createSurfRateStore, fetchImpl = fetch }) {
  const handleAdmin = createParticipationAdminHandler({ readSession, storeFactory });
  return async function handleMissionRoute(req, res, url) {
    if (handleAdmin(req, res, url)) return true;
    if (url.pathname === '/api/missions/surf') {
      method(req, 'GET'); sendJson(res, 200, readMissionState(req, readSession(req), { storeFactory })); return true;
    }
    if (url.pathname === '/api/missions/surf/accounts/verify') {
      method(req, 'POST'); sameOrigin(req);
      const session = readSession(req), user = requireMissionUser(session), store = storeFactory();
      const sessionId = parseCookies(req).get(SESSION_COOKIE);
      if (!sessionId) throw new HttpError(401, 'unauthenticated');
      const assertCurrentUser = () => {
        const current = readSession(req);
        if (current?.user?.sub !== user.sub || current.user.isDemo)
          throw new HttpError(401, 'unauthenticated');
        return current.user;
      };
      // Use the linked email from the verified Renaiss session, never JSON input.
      const recorded = readMissionState(req, session, { storeFactory: () => store });
      if (!recorded.participation?.tasks.accounts.verified)
        await checkAccounts(user, { store, fetchImpl, rateStore: rateStoreFactory(), assertCurrentUser });
      const current = readSession(req);
      if (current?.user?.sub !== user.sub || current.user.isDemo) throw new HttpError(401, 'unauthenticated');
      sendJson(res, 200, readMissionState(req, current, { storeFactory: () => store }));
      return true;
    }
    const task = url.pathname.match(/^\/api\/missions\/surf\/(x|discord)\/(connect|verify|disconnect)$/);
    if (task) {
      method(req, 'POST'); sameOrigin(req);
      const [, provider, action] = task, session = readSession(req), user = requireMissionUser(session);
      const config = providerConfig(req, provider);
      if (provider === 'discord') discordScreeningPolicy();
      const store = storeFactory();
      if (action === 'connect') {
        const recorded = readMissionState(req, session, { storeFactory: () => store });
        if (recorded.participation?.tasks[provider]?.verified) throw new HttpError(409, `${provider}_verified_account_locked`);
        if (provider === 'x' && !user.twitterUsername) throw new HttpError(409, 'renaiss_x_not_linked');
        const release = store.acquire(surfCampaign.id, user.sub, provider, 'connect');
        try {
          const state = randomBytes(32).toString('base64url'), cookie = randomBytes(32).toString('base64url');
          const codeVerifier = randomBytes(32).toString('base64url');
          const returnTo = safeMissionReturnTo(url.searchParams.get('returnTo'));
          store.saveChallenge({ state, cookie, sessionId: parseCookies(req).get(SESSION_COOKIE), sub: user.sub, provider,
            codeVerifier, redirectUri: config.redirectUri, returnTo });
          const auth = new URL(config.authorizeUrl);
          for (const [key, value] of Object.entries({ response_type: 'code', client_id: config.clientId,
            redirect_uri: config.redirectUri, scope: config.scopes.join(' '), state })) auth.searchParams.set(key, value);
          if (provider === 'x') {
            auth.searchParams.set('code_challenge', createHash('sha256').update(codeVerifier).digest('base64url'));
            auth.searchParams.set('code_challenge_method', 'S256');
          } else auth.searchParams.set('prompt', 'consent');
          setCookie(req, res, cookieName(provider), cookie, { maxAge: 600 });
          sendJson(res, 200, { authorizationUrl: auth.href });
        } finally { release(); }
      } else if (action === 'verify') sendJson(res, 200, await checkMission(req, session, provider, { store, fetchImpl }));
      else {
        const release = store.acquire(surfCampaign.id, user.sub, provider);
        try {
          store.deleteConnection(surfCampaign.id, user.sub, provider);
          readMissionState(req, session, { storeFactory: () => store });
          clearCookie(req, res, cookieName(provider)); sendNoContent(res);
        }
        finally { release(); }
      }
      return true;
    }
    const callback = url.pathname.match(/^\/auth\/(x|discord)\/callback$/);
    if (!callback) return false;
    method(req, 'GET');
    const provider = callback[1]; let returnTo = '/v1.2/?preview=hub';
    clearCookie(req, res, cookieName(provider));
    try {
      const session = readSession(req), user = requireMissionUser(session), cookies = parseCookies(req), store = storeFactory();
      const challenge = store.takeChallenge({ state: url.searchParams.get('state'), cookie: cookies.get(cookieName(provider)),
        sessionId: cookies.get(SESSION_COOKIE), sub: user.sub, provider });
      if (!challenge) throw new HttpError(401, 'invalid_social_oauth_state');
      returnTo = challenge.returnTo;
      if (url.searchParams.get('error')) throw new HttpError(401, 'social_authorization_cancelled');
      const code = url.searchParams.get('code'), config = providerConfig(req, provider);
      if (!code || config.redirectUri !== challenge.redirectUri) throw new HttpError(401, 'invalid_social_oauth_state');
      const tokens = await exchangeMissionToken(config, { grant_type: 'authorization_code', code, redirect_uri: challenge.redirectUri,
        ...(provider === 'x' ? { code_verifier: challenge.codeVerifier } : {}) }, { fetchImpl });
      const identity = await readSocialIdentity(provider, tokens.accessToken, { fetchImpl });
      if (provider === 'x') assertLinkedX(user, identity.username);
      // Recheck after network waits: logging out mid-flow must not attach an account.
      const current = readSession(req);
      if (current?.user.sub !== user.sub || current.user.isDemo) throw new HttpError(401, 'unauthenticated');
      const state = await checkMission(req, current, provider, { store, fetchImpl, connectionToSave: { ...tokens, ...identity } });
      redirect(res, returnLocation(returnTo, provider, { missionResult: state.providers[provider].result?.outcome || 'unavailable' }));
    } catch (error) {
      const code = error instanceof HttpError ? error.code : 'mission_verification_failed';
      redirect(res, returnLocation(returnTo, provider, { missionError: code }));
    }
    return true;
  };
}

function cookieName(provider) { return `renaiss_mission_${provider}`; }
function method(req, expected) { if (req.method !== expected) throw new HttpError(405, 'method_not_allowed'); }
function sameOrigin(req) { if (req.headers.origin !== getPublicOrigin(req)) throw new HttpError(403, 'invalid_request_origin'); }
function returnLocation(returnTo, provider, fields) {
  const target = new URL(safeMissionReturnTo(returnTo), 'https://merch.invalid');
  target.searchParams.set('mission', provider);
  for (const [key, value] of Object.entries(fields)) target.searchParams.set(key, value);
  return `${target.pathname}${target.search}${target.hash}`;
}
