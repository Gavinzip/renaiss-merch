import { createHash, randomBytes } from 'node:crypto';
import { parseCookies } from '../cookies.mjs';
import { HttpError, sendJson } from '../http.mjs';
import { readJsonBody } from '../shipping-details.mjs';
import { requireSurfDrawAccess } from './access.mjs';
import { assertLocalSurfOperatorRequest } from './local-operator-guard.mjs';

export const LOCAL_OPERATOR_ROOT = '/api/local/surf-operator';
export const SURF_OPERATOR_ORIGIN = 'https://merch.renaisscltb.com';
const REMOTE_ROOT = '/api/admin/missions/surf/draw';
const OPERATOR_ROOT = `${REMOTE_ROOT}/local-operator`;
const actions = new Set(['', '/prepare', '/finalize', '/request', '/reveal', '/reset']);

// Grants and proof verifiers exist only in this development server's memory.
// No production cookie, signing key or bearer token reaches browser JS.
export function createLocalSurfOperatorHandler({ fetchImpl = fetch, requireAccess = requireSurfDrawAccess } = {}) {
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
    if (connection?.token) {
      const result = await remote(`${OPERATOR_ROOT}/revoke`, { token: connection.token, origin: connection.origin, body: {} });
      if (result.status >= 400 && ![401, 403].includes(result.status)) throw new HttpError(result.status, result.value.code || 'operator_disconnect_failed');
    }
    connections.delete(key);
  }
  return async (req, res, url) => {
    const logout = url.pathname === '/api/auth/surf-draw/logout';
    if (!url.pathname.startsWith(`${LOCAL_OPERATOR_ROOT}/`) && !logout) return false;
    if (logout && process.env.NODE_ENV === 'production') return false;
    assertLocalSurfOperatorRequest(req);
    const cookie = parseCookies(req).get('renaiss_surf_draw_access');
    if (logout && !cookie) return false;
    if (!logout) requireAccess(req);
    const key = createHash('sha256').update(cookie).digest('hex');
    const origin = `http://${req.headers.host}`;
    for (const [id, connection] of connections) if (connection.expiresAt <= Date.now()) connections.delete(id);
    let connection = connections.get(key);
    if (logout) { if (req.method === 'POST') await disconnect(key, connection); return false; }
    const action = url.pathname.slice(LOCAL_OPERATOR_ROOT.length + 1);
    if (!['session', 'start', 'disconnect', 'draw'].includes(action) && !action.startsWith('draw/')) throw new HttpError(404, 'not_found');
    if (action === 'start') {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      await disconnect(key, connection);
      const verifier = randomBytes(32).toString('base64url');
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      const readiness = await remote(`${OPERATOR_ROOT}/exchange`, { body: { verifier, origin } });
      if (readiness.status !== 202) throw new HttpError(readiness.status >= 400 ? readiness.status : 502, readiness.value.code || 'operator_upstream_invalid');
      connections.set(key, { verifier, origin, expiresAt: Date.now() + 300_000 });
      sendJson(res, 200, { authorizeUrl: `${SURF_OPERATOR_ORIGIN}/local-draw-operator?${new URLSearchParams({ origin, challenge })}` });
      return true;
    }
    if (action === 'disconnect') {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      await disconnect(key, connection); sendJson(res, 200, { connected: false }); return true;
    }
    if (action === 'session') {
      if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
      if (connection && connection.origin !== origin) throw new HttpError(403, 'operator_origin_invalid');
      if (connection?.verifier) {
        // Several tabs can poll the same local session. Exchange an approved
        // proof once, and share that single in-flight result.
        connection.exchanging ??= remote(`${OPERATOR_ROOT}/exchange`, { body: { verifier: connection.verifier, origin } });
        let exchanged;
        try { exchanged = await connection.exchanging; } finally { delete connection.exchanging; }
        if (exchanged.status === 200) {
          if (!/^[A-Za-z0-9_-]{43}$/.test(exchanged.value.token || '') || !Number.isFinite(exchanged.value.expiresAt) ||
              exchanged.value.expiresAt <= Date.now()) throw new HttpError(502, 'operator_upstream_invalid');
          connection.token = exchanged.value.token; connection.expiresAt = exchanged.value.expiresAt;
          delete connection.verifier;
        } else if (exchanged.status !== 202) throw new HttpError(exchanged.status, exchanged.value.code || 'operator_exchange_failed');
      }
      if (connection?.token) {
        const current = await remote(`${OPERATOR_ROOT}/session`, { token: connection.token, origin });
        if ([401, 403].includes(current.status)) { connections.delete(key); sendJson(res, 200, { connected: false, code: current.value.code }); return true; }
        if (current.status !== 200) throw new HttpError(current.status, current.value.code || 'operator_session_failed');
        sendJson(res, 200, { connected: current.value.connected === true, name: current.value.name, expiresAt: connection.expiresAt }); return true;
      }
      sendJson(res, 200, { connected: false, pending: Boolean(connection?.verifier) }); return true;
    }
    if (!connection?.token || connection.origin !== origin) throw new HttpError(401, 'operator_connection_required');
    const suffix = action.slice('draw'.length);
    if (!actions.has(suffix) || (suffix === '' ? req.method !== 'GET' : suffix === '/reset' ? !['GET', 'POST'].includes(req.method) : req.method !== 'POST'))
      throw new HttpError(405, 'method_not_allowed');
    const upstream = await remote(`${REMOTE_ROOT}${suffix}`, { token: connection.token, origin,
      ...(req.method === 'POST' ? { body: await readJsonBody(req) } : {}) });
    sendJson(res, upstream.status, upstream.value); return true;
  };
}
