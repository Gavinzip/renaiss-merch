import { randomBytes } from 'node:crypto';
import { authSessionDatabase, sessionIdHash } from './auth-session-database.mjs';
import { createAuthChallengeStore } from './auth-challenge-database.mjs';

export const CHALLENGE_MAX_AGE_SECONDS = 10 * 60;
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function saveChallenge(challenge) {
  return createAuthChallengeStore().save(challenge, CHALLENGE_MAX_AGE_SECONDS * 1000);
}

export function takeChallenge(id) {
  return createAuthChallengeStore().take(id);
}

export function createSession(user) {
  const db = authSessionDatabase();
  db.prepare('DELETE FROM renaiss_identity_sessions WHERE expires_at<=?').run(Date.now());

  const id = randomId();
  const session = {
    user,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  };

  db.prepare('INSERT INTO renaiss_identity_sessions VALUES(?,?,?,?)').run(
    sessionIdHash(id), JSON.stringify(user), session.createdAt, session.expiresAt,
  );

  return {
    id,
    session
  };
}

export function getSession(id) {
  if (!id) {
    return null;
  }

  const db = authSessionDatabase();
  const row = db.prepare('SELECT * FROM renaiss_identity_sessions WHERE id_hash=?').get(sessionIdHash(id));
  const session = row ? { user: JSON.parse(row.user_json), createdAt: row.created_at, expiresAt: row.expires_at } : null;

  if (!session || session.expiresAt <= Date.now()) {
    db.prepare('DELETE FROM renaiss_identity_sessions WHERE id_hash=?').run(sessionIdHash(id));
    return null;
  }

  return session;
}

export function deleteSession(id) {
  if (id) {
    authSessionDatabase().prepare('DELETE FROM renaiss_identity_sessions WHERE id_hash=?').run(sessionIdHash(id));
  }
}

function randomId() {
  return randomBytes(32).toString('base64url');
}
