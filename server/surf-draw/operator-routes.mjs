import { authSessionDatabase, sessionIdHash } from '../auth-session-database.mjs';
import { getPublicOrigin } from '../config.mjs';
import { HttpError, redirect, sendJson } from '../http.mjs';
import { readJsonBody } from '../shipping-details.mjs';
import { authenticateSurfDrawAccess, issueSurfDrawAccess } from './access.mjs';
import { createSurfOperatorGrants, localOperatorOrigin, surfOperatorToken } from './operator-grants.mjs';
export const SURF_OPERATOR_ROOT = '/api/admin/missions/surf/draw/local-operator';
const grants = () => createSurfOperatorGrants(authSessionDatabase());
export async function readSurfOperatorSession(req) {
  const token = surfOperatorToken(req);
  return token ? await grants().read(token, req.headers['x-renaiss-local-origin']) : null;
}
export function createSurfOperatorHandler({
  authenticate = authenticateSurfDrawAccess,
  issueAccess = issueSurfDrawAccess,
  grantStore = grants,
  revokeAccess = async token => await authSessionDatabase().prepare('DELETE FROM surf_draw_access_sessions WHERE id_hash=?').run(sessionIdHash(token))
} = {}) {
  return async (req, res, url) => {
    if (url.pathname === '/local-draw-operator') {
      if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
      redirect(res, '/draw/#draw/surf', 303);
      return true;
    }
    if (!url.pathname.startsWith(`${SURF_OPERATOR_ROOT}/`)) return false;
    const action = url.pathname.slice(SURF_OPERATOR_ROOT.length + 1);
    if (action === 'session') {
      if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
      const session = await grantStore().read(surfOperatorToken(req), req.headers['x-renaiss-local-origin']);
      if (!session) throw new HttpError(401, 'surf_draw_access_required');
      sendJson(res, 200, {
        authenticated: true,
        username: session.user.name
      });
      return true;
    }
    if (!['login', 'revoke'].includes(action)) throw new HttpError(404, 'not_found');
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
    if (req.headers.origin !== getPublicOrigin(req)) throw new HttpError(403, 'invalid_request_origin');
    if (action === 'revoke') {
      await grantStore().revoke(surfOperatorToken(req));
      sendJson(res, 200, {
        authenticated: false
      });
      return true;
    }
    const body = await readJsonBody(req);
    const origin = localOperatorOrigin(body?.origin);
    const username = await authenticate(req, body);
    const access = await issueAccess(username);
    try {
      sendJson(res, 200, await grantStore().issue(origin, access));
    } catch (error) {
      await revokeAccess(access.token);
      throw error;
    }
    return true;
  };
}
