import { createHash, randomBytes } from 'node:crypto';
import { getMerchDatabase } from '../merch-database.mjs';
import { HttpError } from '../http.mjs';
import { missionEncryptionKey } from './config.mjs';
import { createSecretBox } from '../auth-secret-box.mjs';
import { createXIdentityLock } from './x-identity-lock.mjs';
import { createSocialIdentityLock } from './social-identity-lock.mjs';

export const missionHash = value => createHash('sha256').update(value).digest('hex');
export const MISSION_RULE_VERSION = 'surf-social-v1';
export const RESULT_MAX_AGE_MS = 15 * 60_000;
// Covers token refresh and the identity/relationship requests.
const OPERATION_LEASE_MS = 120_000;

export function createMissionStore(db = getMerchDatabase(), key = missionEncryptionKey()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mission_oauth_challenges (
      state_hash TEXT PRIMARY KEY, cookie_hash TEXT NOT NULL, session_hash TEXT NOT NULL,
      user_sub TEXT NOT NULL, provider TEXT NOT NULL, payload TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mission_connections (
      campaign TEXT NOT NULL, user_sub TEXT NOT NULL, provider TEXT NOT NULL, user_id TEXT NOT NULL,
      username TEXT NOT NULL, secret TEXT NOT NULL, updated_at INTEGER NOT NULL,
      PRIMARY KEY(campaign, user_sub, provider), UNIQUE(campaign, provider, user_id)
    );
    CREATE TABLE IF NOT EXISTS mission_results (
      campaign TEXT NOT NULL, rule_version TEXT NOT NULL, user_sub TEXT NOT NULL, provider TEXT NOT NULL,
      result_json TEXT NOT NULL, checked_at INTEGER NOT NULL,
      PRIMARY KEY(campaign, rule_version, user_sub, provider)
    );
    CREATE TABLE IF NOT EXISTS mission_result_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, campaign TEXT NOT NULL, rule_version TEXT NOT NULL,
      user_sub TEXT NOT NULL, provider TEXT NOT NULL, result_json TEXT NOT NULL, checked_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mission_operation_leases (
      operation_key TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL, next_check_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mission_surf_accounts (
      campaign TEXT NOT NULL, email_hash TEXT NOT NULL, user_sub TEXT NOT NULL,
      PRIMARY KEY(campaign,email_hash), UNIQUE(campaign,user_sub)
    );
  `);
  const { seal, unseal } = createSecretBox(key);
  const xIdentityLock = createXIdentityLock(db);
  const identityLocks = { x: xIdentityLock, discord: createSocialIdentityLock(db, 'discord') };
  const connectionContext = (campaign, sub, provider, id) => JSON.stringify([campaign, sub, provider, id]);
  return {
    database: db,
    getXIdentityLock: (campaign, sub) => xIdentityLock.read(campaign, sub),
    assertXIdentity: (campaign, sub, userId) => xIdentityLock.assertIdentity(campaign, sub, userId),
    getSocialIdentityLock: (campaign, sub, provider) => identityLocks[provider]?.read(campaign, sub) || null,
    assertSocialIdentity: (campaign, sub, provider, userId) => identityLocks[provider]?.assertIdentity(campaign, sub, userId),
    assertAccountAvailable(campaign, sub, emailHash) {
      const row = db.prepare('SELECT user_sub FROM mission_surf_accounts WHERE campaign=? AND email_hash=?').get(campaign, emailHash);
      if (row && row.user_sub !== sub) throw new HttpError(409, 'surf_account_already_connected');
    },
    bindAccount(campaign, sub, emailHash) {
      try {
        db.prepare(`INSERT INTO mission_surf_accounts VALUES(?,?,?) ON CONFLICT(campaign,user_sub)
          DO UPDATE SET email_hash=excluded.email_hash`).run(campaign, emailHash, sub);
      } catch (error) {
        if (error.code?.startsWith('SQLITE_CONSTRAINT')) throw new HttpError(409, 'surf_account_already_connected');
        throw error;
      }
    },
    saveChallenge({ state, cookie, sessionId, sub, provider, ...payload }) {
      db.prepare('DELETE FROM mission_oauth_challenges WHERE expires_at <= ?').run(Date.now());
      const stateHash = missionHash(state);
      db.prepare('INSERT INTO mission_oauth_challenges VALUES(?,?,?,?,?,?,?)').run(
        stateHash, missionHash(cookie), missionHash(sessionId), sub, provider,
        seal(payload, stateHash), Date.now() + 10 * 60_000,
      );
    },
    takeChallenge({ state, cookie, sessionId, sub, provider }) {
      if (!state || !cookie || !sessionId) return null;
      const stateHash = missionHash(state);
      const row = db.prepare(`DELETE FROM mission_oauth_challenges WHERE state_hash=? AND cookie_hash=? AND session_hash=?
        AND user_sub=? AND provider=? AND expires_at>? RETURNING payload`).get(
        stateHash, missionHash(cookie), missionHash(sessionId), sub, provider, Date.now(),
      );
      return row ? unseal(row.payload, stateHash) : null;
    },
    getConnection(campaign, sub, provider) {
      const row = db.prepare('SELECT * FROM mission_connections WHERE campaign=? AND user_sub=? AND provider=?').get(campaign, sub, provider);
      return row ? { ...unseal(row.secret, connectionContext(campaign, sub, provider, row.user_id)), userId: row.user_id, username: row.username } : null;
    },
    saveConnection(campaign, sub, provider, connection) {
      const secret = seal(connection, connectionContext(campaign, sub, provider, connection.userId));
      try {
        db.transaction(() => {
          identityLocks[provider]?.assertIdentity(campaign, sub, connection.userId);
          const previous = db.prepare('SELECT user_id FROM mission_connections WHERE campaign=? AND user_sub=? AND provider=?')
            .get(campaign, sub, provider);
          db.prepare(`INSERT INTO mission_connections VALUES(?,?,?,?,?,?,?) ON CONFLICT(campaign,user_sub,provider)
            DO UPDATE SET user_id=excluded.user_id,username=excluded.username,secret=excluded.secret,updated_at=excluded.updated_at`).run(
            campaign, sub, provider, connection.userId, connection.username, secret, Date.now(),
          );
          // Token renewal for the same provider identity must not erase a pass
          // while a new network check is pending. A new identity invalidates it.
          if (previous?.user_id !== connection.userId)
            db.prepare('DELETE FROM mission_results WHERE campaign=? AND user_sub=? AND provider=?').run(campaign, sub, provider);
        }).immediate();
      } catch (error) {
        if (error.code?.startsWith('SQLITE_CONSTRAINT')) throw new HttpError(409, 'social_account_already_connected');
        throw error;
      }
    },
    deleteConnection(campaign, sub, provider) {
      db.transaction(() => {
        identityLocks[provider]?.assertDisconnectAllowed(campaign, sub);
        db.prepare('DELETE FROM mission_connections WHERE campaign=? AND user_sub=? AND provider=?').run(campaign, sub, provider);
        db.prepare('DELETE FROM mission_results WHERE campaign=? AND user_sub=? AND provider=?').run(campaign, sub, provider);
        db.prepare('DELETE FROM mission_oauth_challenges WHERE user_sub=? AND provider=?').run(sub, provider);
      }).immediate();
    },
    saveResult(campaign, sub, provider, result) {
      const payload = JSON.stringify(result), checkedAt = Date.now();
      db.transaction(() => {
        if (identityLocks[provider] && result.outcome === 'verified') {
          const identity = db.prepare('SELECT user_id FROM mission_connections WHERE campaign=? AND user_sub=? AND provider=?')
            .get(campaign, sub, provider);
          if (!identity) throw new HttpError(409, 'connection_required');
          identityLocks[provider].lock(campaign, sub, identity.user_id, result.checkedAt || new Date(checkedAt).toISOString());
        }
        db.prepare(`INSERT INTO mission_results VALUES(?,?,?,?,?,?) ON CONFLICT(campaign,rule_version,user_sub,provider)
          DO UPDATE SET result_json=excluded.result_json,checked_at=excluded.checked_at`).run(
          campaign, MISSION_RULE_VERSION, sub, provider, payload, checkedAt,
        );
        db.prepare(`INSERT INTO mission_result_history(campaign,rule_version,user_sub,provider,result_json,checked_at)
          VALUES(?,?,?,?,?,?)`).run(campaign, MISSION_RULE_VERSION, sub, provider, payload, checkedAt);
      }).immediate();
    },
    getResult(campaign, sub, provider) {
      const row = db.prepare('SELECT * FROM mission_results WHERE campaign=? AND rule_version=? AND user_sub=? AND provider=?').get(campaign, MISSION_RULE_VERSION, sub, provider);
      if (!row) return null;
      const { evidence: _evidence, ...result } = JSON.parse(row.result_json);
      return { ...result, stale: row.checked_at + RESULT_MAX_AGE_MS <= Date.now() };
    },
    acquire(campaign, sub, provider, purpose = 'verify') {
      const operationKey = JSON.stringify([campaign, sub, provider, purpose]), owner = randomBytes(24).toString('hex'), now = Date.now();
      const acquired = db.prepare(`INSERT INTO mission_operation_leases VALUES(?,?,?,?) ON CONFLICT(operation_key) DO UPDATE
        SET owner=excluded.owner,expires_at=excluded.expires_at,next_check_at=excluded.next_check_at
        WHERE mission_operation_leases.expires_at<=? AND mission_operation_leases.next_check_at<=?`).run(
        operationKey, owner, now + OPERATION_LEASE_MS, now + 10_000, now, now,
      );
      if (!acquired.changes) throw new HttpError(429, 'mission_check_busy');
      return () => db.prepare('UPDATE mission_operation_leases SET expires_at=0 WHERE operation_key=? AND owner=?').run(operationKey, owner);
    },
  };
}
