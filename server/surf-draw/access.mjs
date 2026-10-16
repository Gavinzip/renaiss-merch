import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { parseCookies, setCookie, clearCookie } from '../cookies.mjs';
import { getPublicOrigin } from '../config.mjs';
import { HttpError, sendJson } from '../http.mjs';
import { authSessionDatabase, sessionIdHash } from '../auth-session-database.mjs';
import { readJsonBody } from '../shipping-details.mjs';
import { parseSurfDrawPasswordHash, verifySurfDrawPassword } from './access-credential.mjs';

const ROOT = '/api/auth/surf-draw';
const COOKIE = 'renaiss_surf_draw_access';
const SESSION_SECONDS = 12 * 60 * 60;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;

function configuration() {
  const username = process.env.SURF_DRAW_ACCESS_USERNAME?.trim();
  const hash = process.env.SURF_DRAW_ACCESS_PASSWORD_HASH?.trim();
  if (!username && !hash) return null;
  if (!USERNAME_PATTERN.test(username || '') || !hash) throw new HttpError(503, 'surf_draw_access_config_invalid');
  const parsed = parseSurfDrawPasswordHash(hash);
  if (!parsed) throw new HttpError(503, 'surf_draw_access_config_invalid');
  return { username, parsed, fingerprint: createHash('sha256').update(`${username}:${hash}`).digest('hex') };
}

export const surfDrawCredentialFingerprint = () => configuration()?.fingerprint || null;
export const surfDrawAccessConfigured = () => Boolean(configuration());

function database() {
  const db = authSessionDatabase();
  db.exec(`CREATE TABLE IF NOT EXISTS surf_draw_access_sessions (
    id_hash TEXT PRIMARY KEY, username TEXT NOT NULL, credential_fingerprint TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS surf_draw_login_throttle (
    address_hash TEXT PRIMARY KEY, failures INTEGER NOT NULL, window_start INTEGER NOT NULL,
    locked_until INTEGER NOT NULL
  )`);
  return db;
}

export function readSurfDrawAccess(req) {
  const id = parseCookies(req).get(COOKIE);
  if (!id || id.length > 128) return null;
  return readSurfDrawAccessHash(sessionIdHash(id));
}

export function readSurfDrawAccessHash(idHash, db = database()) {
  const config = configuration();
  if (!config) return null;
  const session = db.prepare('SELECT username,credential_fingerprint,expires_at FROM surf_draw_access_sessions WHERE id_hash=?').get(idHash);
  if (!session) return null;
  if (session.expires_at <= Date.now() || session.credential_fingerprint !== config.fingerprint) {
    db.prepare('DELETE FROM surf_draw_access_sessions WHERE id_hash=?').run(idHash);
    return null;
  }
  return { username: session.username, expiresAt: session.expires_at };
}

// A dedicated draw-room login authorizes this draw only. It does not grant
// Renaiss SSO or fulfillment permissions.
export function surfDrawOperatorSession(access) {
  return { user: { sub: `surf-operator:${access.username}`, name: access.username, isDemo: false }, expiresAt: access.expiresAt };
}

export async function authenticateSurfDrawAccess(req, body, db = database()) {
  const config = configuration();
  if (!config) throw new HttpError(503, 'surf_draw_access_not_configured');
  const username = typeof body?.username === 'string' && body.username.length <= 64 ? body.username : '';
  const password = typeof body?.password === 'string' && body.password.length <= 256 ? body.password : '';
  const addressHash = clientAddressHash(req), now = Date.now();
  db.transaction(() => {
    const throttle = db.prepare('SELECT * FROM surf_draw_login_throttle WHERE address_hash=?').get(addressHash);
    if (throttle?.locked_until > now) throw new HttpError(429, 'surf_draw_login_rate_limited');
    const withinWindow = throttle && now - throttle.window_start < WINDOW_MS;
    const failures = withinWindow ? throttle.failures + 1 : 1;
    db.prepare(`INSERT INTO surf_draw_login_throttle (address_hash,failures,window_start,locked_until) VALUES(?,?,?,?)
      ON CONFLICT(address_hash) DO UPDATE SET failures=excluded.failures,window_start=excluded.window_start,locked_until=excluded.locked_until`)
      .run(addressHash, failures, withinWindow ? throttle.window_start : now, failures >= MAX_FAILURES ? now + WINDOW_MS : 0);
  }).immediate();
  const userMatch = safeEqual(username, config.username);
  const passwordMatch = await verifySurfDrawPassword(password, config.parsed);
  if (!userMatch || !passwordMatch) throw new HttpError(401, 'surf_draw_invalid_credentials');
  db.prepare('DELETE FROM surf_draw_login_throttle WHERE address_hash=?').run(addressHash);
  return { username: config.username, fingerprint: config.fingerprint };
}

export function issueSurfDrawAccess(identity, db = database()) {
  const username = typeof identity === 'string' ? identity : identity.username;
  const config = configuration();
  if (!config || username !== config.username) throw new HttpError(503, 'surf_draw_access_config_invalid');
  if (typeof identity !== 'string' && identity.fingerprint !== config.fingerprint)
    throw new HttpError(401, 'surf_draw_invalid_credentials');
  const token = randomBytes(32).toString('base64url'), expiresAt = Date.now() + SESSION_SECONDS * 1000;
  db.prepare('DELETE FROM surf_draw_access_sessions WHERE expires_at<=?').run(Date.now());
  db.prepare('INSERT INTO surf_draw_access_sessions VALUES(?,?,?,?)').run(sessionIdHash(token), username, config.fingerprint, expiresAt);
  return { token, username, expiresAt };
}

export function setSurfDrawAccessCookie(req, res, session) {
  setCookie(req, res, COOKIE, session.token, { maxAge: SESSION_SECONDS });
}

export function requireSurfDrawAccess(req) {
  if (!configuration()) throw new HttpError(503, 'surf_draw_access_not_configured');
  const access = readSurfDrawAccess(req);
  if (!access) throw new HttpError(401, 'surf_draw_access_required');
  return access;
}

export async function handleSurfDrawAccessRoute(req, res, url) {
  if (url.pathname === `${ROOT}/session`) {
    requireMethod(req, 'GET');
    const config = configuration();
    const access = config ? readSurfDrawAccess(req) : null;
    sendJson(res, 200, { configured: Boolean(config), authenticated: Boolean(access), username: access?.username ?? null });
    return true;
  }
  if (url.pathname === `${ROOT}/login`) {
    requireMethod(req, 'POST');
    requireOrigin(req);
    const identity = await authenticateSurfDrawAccess(req, await readJsonBody(req));
    const session = issueSurfDrawAccess(identity);
    setSurfDrawAccessCookie(req, res, session);
    sendJson(res, 200, { authenticated: true, username: session.username });
    return true;
  }
  if (url.pathname === `${ROOT}/logout`) {
    requireMethod(req, 'POST');
    requireOrigin(req);
    const id = parseCookies(req).get(COOKIE);
    if (id && id.length <= 128) database().prepare('DELETE FROM surf_draw_access_sessions WHERE id_hash=?').run(sessionIdHash(id));
    clearCookie(req, res, COOKIE);
    sendJson(res, 200, { authenticated: false });
    return true;
  }
  return false;
}

function safeEqual(a, b) {
  const left = createHash('sha256').update(a).digest(), right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}
function clientAddressHash(req) {
  return createHash('sha256').update(req.socket.remoteAddress || 'unknown').digest('hex');
}
function requireMethod(req, method) {
  if (req.method !== method) throw new HttpError(405, 'method_not_allowed');
}
function requireOrigin(req) {
  if (req.headers.origin !== getPublicOrigin(req)) throw new HttpError(403, 'invalid_request_origin');
}
