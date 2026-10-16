import { authSessionDatabase } from '../auth-session-database.mjs';
import { getPublicOrigin } from '../config.mjs';
import { parseCookies, SESSION_COOKIE } from '../cookies.mjs';
import { canManageFulfillment, requireFulfillmentAdministrator } from '../fulfillment-admin.mjs';
import { HttpError, sendJson } from '../http.mjs';
import { readJsonBody } from '../shipping-details.mjs';
import { readSurfDrawAccess, requireSurfDrawAccess } from './access.mjs';
import { createSurfOperatorGrants, localOperatorOrigin, surfOperatorToken } from './operator-grants.mjs';
import { sendSurfOperatorConnectPage } from './operator-connect-page.mjs';

export const SURF_OPERATOR_ROOT = '/api/admin/missions/surf/draw/local-operator';
const grants = () => createSurfOperatorGrants(authSessionDatabase());

export function readSurfOperatorSession(req) {
  const token = surfOperatorToken(req);
  return token ? grants().read(token, req.headers['x-renaiss-local-origin']) : null;
}

export function createSurfOperatorHandler({ readSession }) {
  return async (req, res, url) => {
    if (url.pathname === '/local-draw-operator') {
      if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
      const origin = localOperatorOrigin(url.searchParams.get('origin'));
      const challenge = url.searchParams.get('challenge');
      if (!/^[A-Za-z0-9_-]{43}$/.test(challenge || '')) throw new HttpError(400, 'operator_challenge_invalid');
      const session = readSession(req);
      sendSurfOperatorConnectPage(res, { origin, challenge, hasAccess: Boolean(readSurfDrawAccess(req)), session,
        administrator: Boolean(session && !session.user.isDemo && canManageFulfillment(session)) });
      return true;
    }
    if (!url.pathname.startsWith(`${SURF_OPERATOR_ROOT}/`)) return false;
    const action = url.pathname.slice(SURF_OPERATOR_ROOT.length + 1);
    if (action === 'session') {
      if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
      const session = readSurfOperatorSession(req);
      if (!session) throw new HttpError(401, 'operator_connection_required');
      sendJson(res, 200, { connected: true, name: session.user.name || 'Renaiss 管理員' }); return true;
    }
    if (!['exchange', 'approve', 'revoke'].includes(action)) throw new HttpError(404, 'not_found');
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
    if (action === 'exchange') {
      const result = grants().exchange(await readJsonBody(req));
      sendJson(res, result ? 200 : 202, result || { pending: true });
      return true;
    }
    if (action === 'revoke') {
      readSurfOperatorSession(req);
      grants().revoke(surfOperatorToken(req));
      sendJson(res, 200, { disconnected: true }); return true;
    }
    if (req.headers.origin !== getPublicOrigin(req)) throw new HttpError(403, 'invalid_request_origin');
    requireSurfDrawAccess(req);
    const session = readSession(req);
    requireFulfillmentAdministrator(session);
    if (session.user.isDemo) throw new HttpError(403, 'demo_missions_disabled');
    const body = await readJsonBody(req), cookies = parseCookies(req);
    grants().approve({ ...body, identityCookie: cookies.get(SESSION_COOKIE), accessCookie: cookies.get('renaiss_surf_draw_access') });
    sendJson(res, 200, { approved: true }); return true;
  };
}
