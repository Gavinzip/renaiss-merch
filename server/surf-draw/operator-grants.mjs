import { createHash, randomBytes } from 'node:crypto';
import { HttpError } from '../http.mjs';
import { requireFulfillmentAdministrator } from '../fulfillment-admin.mjs';
import { surfDrawCredentialFingerprint } from './access.mjs';

const hash = value => createHash('sha256').update(value).digest('base64url');
const sessionHash = value => createHash('sha256').update(value).digest('hex');
const proofPattern = /^[A-Za-z0-9_-]{43}$/;

export function localOperatorOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
        url.origin === value && url.port && Number(url.port) > 0) return value;
  } catch {}
  throw new HttpError(400, 'operator_origin_invalid');
}

export function createSurfOperatorGrants(db, fingerprint = surfDrawCredentialFingerprint) {
  db.exec(`CREATE TABLE IF NOT EXISTS surf_operator_approvals (
    challenge TEXT PRIMARY KEY, local_origin TEXT NOT NULL, identity_hash TEXT NOT NULL,
    access_hash TEXT NOT NULL, expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS surf_operator_grants (
    token_hash TEXT PRIMARY KEY, local_origin TEXT NOT NULL, identity_hash TEXT NOT NULL,
    access_hash TEXT NOT NULL, expires_at INTEGER NOT NULL
  )`);

  function identity(record) {
    if (!record || record.expires_at <= Date.now()) throw new HttpError(401, 'operator_connection_expired');
    const identity = db.prepare('SELECT * FROM renaiss_identity_sessions WHERE id_hash=?').get(record.identity_hash);
    const access = db.prepare('SELECT * FROM surf_draw_access_sessions WHERE id_hash=?').get(record.access_hash);
    if (!identity || identity.expires_at <= Date.now() || !access || access.expires_at <= Date.now() ||
        access.credential_fingerprint !== fingerprint()) throw new HttpError(401, 'operator_connection_expired');
    const session = { user: JSON.parse(identity.user_json), expiresAt: identity.expires_at };
    requireFulfillmentAdministrator(session);
    if (session.user.isDemo) throw new HttpError(403, 'demo_missions_disabled');
    return { session, expiresAt: Math.min(record.expires_at, identity.expires_at, access.expires_at) };
  }

  return {
    approve({ challenge, origin, identityCookie, accessCookie }) {
      localOperatorOrigin(origin);
      if (!proofPattern.test(challenge) || !identityCookie || !accessCookie) throw new HttpError(400, 'operator_challenge_invalid');
      const record = { identity_hash: sessionHash(identityCookie), access_hash: sessionHash(accessCookie), expires_at: Date.now() + 300_000 };
      identity(record);
      db.prepare('DELETE FROM surf_operator_approvals WHERE expires_at<=?').run(Date.now());
      db.prepare('DELETE FROM surf_operator_grants WHERE expires_at<=?').run(Date.now());
      db.prepare('INSERT OR REPLACE INTO surf_operator_approvals VALUES(?,?,?,?,?)').run(challenge, origin, record.identity_hash, record.access_hash, record.expires_at);
    },
    exchange({ verifier, origin }) {
      localOperatorOrigin(origin);
      if (!proofPattern.test(verifier)) throw new HttpError(400, 'operator_challenge_invalid');
      return db.transaction(() => {
        const challenge = hash(verifier);
        const record = db.prepare('SELECT * FROM surf_operator_approvals WHERE challenge=? AND local_origin=?').get(challenge, origin);
        if (!record) return null;
        identity(record);
        const token = randomBytes(32).toString('base64url');
        const expiresAt = Date.now() + 3_600_000;
        db.prepare('INSERT INTO surf_operator_grants VALUES(?,?,?,?,?)').run(hash(token), origin, record.identity_hash, record.access_hash, expiresAt);
        db.prepare('DELETE FROM surf_operator_approvals WHERE challenge=?').run(challenge);
        return { token, expiresAt };
      }).immediate();
    },
    read(token, origin) {
      if (!proofPattern.test(token || '')) throw new HttpError(401, 'operator_connection_required');
      localOperatorOrigin(origin);
      const record = db.prepare('SELECT * FROM surf_operator_grants WHERE token_hash=? AND local_origin=?').get(hash(token), origin);
      return identity(record).session;
    },
    revoke(token) { if (proofPattern.test(token || '')) db.prepare('DELETE FROM surf_operator_grants WHERE token_hash=?').run(hash(token)); },
  };
}

export function surfOperatorToken(req) {
  const header = req.headers.authorization;
  return typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;
}
