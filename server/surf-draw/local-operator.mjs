import { createHash } from 'node:crypto';
import { parseCookies } from '../cookies.mjs';
import { HttpError, sendJson } from '../http.mjs';
import { readJsonBody } from '../shipping-details.mjs';
import { issueSurfDrawAccess, readSurfDrawAccess, requireSurfDrawAccess, setSurfDrawAccessCookie, surfDrawAccessConfigured } from './access.mjs';
import { assertLocalSurfOperatorRequest } from './local-operator-guard.mjs';

export const LOCAL_OPERATOR_ROOT = '/api/local/surf-operator';
export const SURF_OPERATOR_ORIGIN = 'https://merch.renaisscltb.com';
const AUTH_ROOT = '/api/auth/surf-draw';
const REMOTE_ROOT = '/api/admin/missions/surf/draw';
const OPERATOR_ROOT = `${REMOTE_ROOT}/local-operator`;
const actions = new Set(['', '/prepare', '/finalize', '/request', '/reveal', '/reset']);
const digest = token => createHash('sha256').update(token).digest('hex');

export function createLocalSurfOperatorHandler({ fetchImpl = fetch, access = {
  read: readSurfDrawAccess, require: requireSurfDrawAccess, issue: issueSurfDrawAccess,
  setCookie: setSurfDrawAccessCookie, configured: surfDrawAccessConfigured,
} } = {}) {
  const connections = new Map();
  async function remote(path, { body, token, origin } = {}) {
    let response;
    try {
      response = await fetchImpl(`${SURF_OPERATOR_ORIGIN}${path}`, {
        method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(25_000),
        headers: { Accept: 'application/json', Origin: SURF_OPERATOR_ORIGIN,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}`, 'X-Renaiss-Local-Origin': origin } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new HttpError(502, 'operator_upstream_unavailable'); }
    if (!response.headers.get('content-type')?.includes('application/json')) throw new HttpError(502, 'operator_upstream_invalid');
    const value = await response.json();
    if (response.status === 404) throw new HttpError(503, 'operator_bridge_not_deployed');
    return { status: response.status, value };
  }
  async function disconnect(key, connection) {
    if (connection) {
      const result = await remote(`${OPERATOR_ROOT}/revoke`, { ...connection, body: {} });
      if (result.status >= 400 && ![401, 403].includes(result.status)) throw new HttpError(result.status, result.value.code || 'surf_draw_logout_failed');
    }
    connections.delete(key);
  }
  return async (req, res, url) => {
    const authAction = url.pathname.startsWith(`${AUTH_ROOT}/`) ? url.pathname.slice(AUTH_ROOT.length + 1) : null;
    if (!url.pathname.startsWith(`${LOCAL_OPERATOR_ROOT}/`) && !['session', 'login', 'logout'].includes(authAction)) return false;
    if (process.env.NODE_ENV === 'production' && authAction) return false;
    assertLocalSurfOperatorRequest(req);
    const cookie = parseCookies(req).get('renaiss_surf_draw_access');
    const key = cookie ? digest(cookie) : null;
    const origin = `http://${req.headers.host}`;
    for (const [id, connection] of connections) if (connection.expiresAt <= Date.now()) connections.delete(id);
    const connection = connections.get(key);
    if (authAction === 'login') {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      const body = await readJsonBody(req);
      const result = await remote(`${OPERATOR_ROOT}/login`, { body: { username: body?.username, password: body?.password, origin } });
      if (result.status !== 200) throw new HttpError(result.status, result.value.code || 'surf_draw_invalid_credentials');
      const grant = result.value;
      if (!/^[A-Za-z0-9_-]{43}$/.test(grant.token || '') || typeof grant.username !== 'string' ||
          !Number.isFinite(grant.expiresAt) || grant.expiresAt <= Date.now()) throw new HttpError(502, 'operator_upstream_invalid');
      try {
        const session = access.issue(grant.username);
        await disconnect(key, connection);
        connections.set(digest(session.token), { token: grant.token, expiresAt: grant.expiresAt, origin });
        access.setCookie(req, res, session);
        sendJson(res, 200, { authenticated: true, username: grant.username });
      } catch (error) { await disconnect(null, { token: grant.token, origin }); throw error; }
      return true;
    }
    if (authAction === 'logout') {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      await disconnect(key, connection);
      return false; // The shared access handler expires the local HttpOnly cookie.
    }
    if (authAction === 'session') {
      if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
      if (!access.read(req) || !connection) {
        sendJson(res, 200, { configured: access.configured(), authenticated: false, username: null }); return true;
      }
      const result = await remote(`${OPERATOR_ROOT}/session`, connection);
      if ([401, 403].includes(result.status)) { connections.delete(key); sendJson(res, 200, { configured: true, authenticated: false, username: null }); return true; }
      if (result.status !== 200) throw new HttpError(result.status, result.value.code || 'operator_upstream_invalid');
      sendJson(res, 200, { configured: true, authenticated: result.value.authenticated === true, username: result.value.username }); return true;
    }
    access.require(req);
    if (!connection || connection.origin !== origin) throw new HttpError(401, 'surf_draw_access_required');
    const action = url.pathname.slice(LOCAL_OPERATOR_ROOT.length + 1);
    if (!action.startsWith('draw')) throw new HttpError(404, 'not_found');
    const suffix = action.slice('draw'.length);
    if (!actions.has(suffix) || (suffix === '' ? req.method !== 'GET' : suffix === '/reset' ? !['GET', 'POST'].includes(req.method) : req.method !== 'POST'))
      throw new HttpError(405, 'method_not_allowed');
    const result = await remote(`${REMOTE_ROOT}${suffix}`, { ...connection,
      ...(req.method === 'POST' ? { body: await readJsonBody(req) } : {}) });
    sendJson(res, result.status, result.value); return true;
  };
}
