import { createHash, randomBytes } from 'node:crypto';
import { HttpError } from '../http.mjs';
import { readSurfDrawAccessHash, surfDrawOperatorSession } from './access.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function localOperatorOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
        url.origin === value && url.port && Number(url.port) > 0) return value;
  } catch {}
  throw new HttpError(400, 'operator_origin_invalid');
}

// Local server credentials are bound to the authenticated draw-room session.
// Neither the online cookie nor the delegation token is returned to browser JS.
export function createSurfOperatorGrants(db, readAccess = id => readSurfDrawAccessHash(id, db)) {
  db.exec(`CREATE TABLE IF NOT EXISTS surf_draw_local_grants (
    token_hash TEXT PRIMARY KEY, local_origin TEXT NOT NULL,
    access_hash TEXT NOT NULL, expires_at INTEGER NOT NULL
  )`);
  return {
    issue(origin, access) {
      localOperatorOrigin(origin);
      const accessHash = hash(access.token);
      if (!readAccess(accessHash)) throw new HttpError(401, 'surf_draw_access_required');
      db.prepare('DELETE FROM surf_draw_local_grants WHERE expires_at<=?').run(Date.now());
      const token = randomBytes(32).toString('base64url');
      db.prepare('INSERT INTO surf_draw_local_grants VALUES(?,?,?,?)').run(hash(token), origin, accessHash, access.expiresAt);
      return { token, expiresAt: access.expiresAt, username: access.username };
    },
    read(token, origin) {
      if (!tokenPattern.test(token || '')) throw new HttpError(401, 'surf_draw_access_required');
      localOperatorOrigin(origin);
      const record = db.prepare('SELECT * FROM surf_draw_local_grants WHERE token_hash=? AND local_origin=?').get(hash(token), origin);
      const access = record && record.expires_at > Date.now() ? readAccess(record.access_hash) : null;
      if (!access) throw new HttpError(401, 'surf_draw_access_required');
      return surfDrawOperatorSession(access);
    },
    revoke(token) {
      if (!tokenPattern.test(token || '')) return;
      db.transaction(() => {
        const record = db.prepare('SELECT access_hash FROM surf_draw_local_grants WHERE token_hash=?').get(hash(token));
        if (record) db.prepare('DELETE FROM surf_draw_access_sessions WHERE id_hash=?').run(record.access_hash);
        db.prepare('DELETE FROM surf_draw_local_grants WHERE token_hash=?').run(hash(token));
      }).immediate();
    },
  };
}

export function surfOperatorToken(req) {
  const header = req.headers.authorization;
  return typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;
}
