import { createHash, randomBytes } from 'node:crypto';
import { getWorkflowDatabase as getMerchDatabase } from '../postgres/statements.mjs';
import { HttpError } from '../http.mjs';
import { missionEncryptionKey } from './config.mjs';
import { createSecretBox } from '../auth-secret-box.mjs';
import { createXIdentityLock } from './x-identity-lock.mjs';
import { createSocialIdentityLock } from './social-identity-lock.mjs';
import { createManualAccountOverrideStore } from './manual-account-override.mjs';
import { assertSurfCampaignOpen } from './campaign-window.mjs';
export const missionHash = value => createHash('sha256').update(value).digest('hex');
export const MISSION_RULE_VERSION = 'surf-social-v1';
export const RESULT_MAX_AGE_MS = 15 * 60_000;
// Covers token refresh and the identity/relationship requests.
const OPERATION_LEASE_MS = 120_000;
export function createMissionStore(db = getMerchDatabase(), key = missionEncryptionKey()) {
  const {
    seal,
    unseal
  } = createSecretBox(key);
  const xIdentityLock = createXIdentityLock(db);
  const identityLocks = {
    x: xIdentityLock,
    discord: createSocialIdentityLock(db, 'discord')
  };
  const manualAccounts = createManualAccountOverrideStore(db);
  const connectionContext = (campaign, sub, provider, id) => JSON.stringify([campaign, sub, provider, id]);
  return {
    database: db,
    getManualAccountOverride: manualAccounts.read,
    async approveManualAccount(approval) {
      assertSurfCampaignOpen(approval.campaign);
      return await manualAccounts.approve(approval);
    },
    getXIdentityLock: async (campaign, sub) => await xIdentityLock.read(campaign, sub),
    assertXIdentity: async (campaign, sub, userId) => await xIdentityLock.assertIdentity(campaign, sub, userId),
    getSocialIdentityLock: async (campaign, sub, provider) => (await identityLocks[provider]?.read(campaign, sub)) || null,
    assertSocialIdentity: async (campaign, sub, provider, userId) => await identityLocks[provider]?.assertIdentity(campaign, sub, userId),
    async assertAccountAvailable(campaign, sub, emailHash) {
      const row = await db.prepare('SELECT user_sub FROM mission_surf_accounts WHERE campaign=? AND email_hash=?').get(campaign, emailHash);
      if (row && row.user_sub !== sub) throw new HttpError(409, 'surf_account_already_connected');
    },
    async bindAccount(campaign, sub, emailHash) {
      assertSurfCampaignOpen(campaign);
      try {
        await db.prepare(`INSERT INTO mission_surf_accounts VALUES(?,?,?) ON CONFLICT(campaign,user_sub)
          DO UPDATE SET email_hash=excluded.email_hash`).run(campaign, emailHash, sub);
      } catch (error) {
        if (error.code === '23505') throw new HttpError(409, 'surf_account_already_connected');
        throw error;
      }
    },
    async saveChallenge({
      state,
      cookie,
      sessionId,
      sub,
      provider,
      ...payload
    }) {
      assertSurfCampaignOpen();
      await db.prepare('DELETE FROM mission_oauth_challenges WHERE expires_at <= ?').run(Date.now());
      const stateHash = missionHash(state);
      await db.prepare('INSERT INTO mission_oauth_challenges VALUES(?,?,?,?,?,?,?)').run(stateHash, missionHash(cookie), missionHash(sessionId), sub, provider, seal(payload, stateHash), Date.now() + 10 * 60_000);
    },
    async takeChallenge({
      state,
      cookie,
      sessionId,
      sub,
      provider
    }) {
      if (!state || !cookie || !sessionId) return null;
      const stateHash = missionHash(state);
      const row = await db.prepare(`DELETE FROM mission_oauth_challenges WHERE state_hash=? AND cookie_hash=? AND session_hash=?
        AND user_sub=? AND provider=? AND expires_at>? RETURNING payload`).get(stateHash, missionHash(cookie), missionHash(sessionId), sub, provider, Date.now());
      return row ? unseal(row.payload, stateHash) : null;
    },
    async getConnection(campaign, sub, provider) {
      const row = await db.prepare('SELECT * FROM mission_connections WHERE campaign=? AND user_sub=? AND provider=?').get(campaign, sub, provider);
      return row ? {
        ...unseal(row.secret, connectionContext(campaign, sub, provider, row.user_id)),
        userId: row.user_id,
        username: row.username
      } : null;
    },
    async saveConnection(campaign, sub, provider, connection) {
      assertSurfCampaignOpen(campaign);
      const secret = seal(connection, connectionContext(campaign, sub, provider, connection.userId));
      try {
        await db.transaction(async () => {
          assertSurfCampaignOpen(campaign);
          await identityLocks[provider]?.assertIdentity(campaign, sub, connection.userId);
          const previous = await db.prepare('SELECT user_id FROM mission_connections WHERE campaign=? AND user_sub=? AND provider=?').get(campaign, sub, provider);
          await db.prepare(`INSERT INTO mission_connections VALUES(?,?,?,?,?,?,?) ON CONFLICT(campaign,user_sub,provider)
            DO UPDATE SET user_id=excluded.user_id,username=excluded.username,secret=excluded.secret,updated_at=excluded.updated_at`).run(campaign, sub, provider, connection.userId, connection.username, secret, Date.now());
          // Token renewal for the same provider identity must not erase a pass
          // while a new network check is pending. A new identity invalidates it.
          if (previous?.user_id !== connection.userId) await db.prepare('DELETE FROM mission_results WHERE campaign=? AND user_sub=? AND provider=?').run(campaign, sub, provider);
        }).immediate();
      } catch (error) {
        if (error.code === '23505') throw new HttpError(409, 'social_account_already_connected');
        throw error;
      }
    },
    async deleteConnection(campaign, sub, provider) {
      await db.transaction(async () => {
        assertSurfCampaignOpen(campaign);
        await identityLocks[provider]?.assertDisconnectAllowed(campaign, sub);
        await db.prepare('DELETE FROM mission_connections WHERE campaign=? AND user_sub=? AND provider=?').run(campaign, sub, provider);
        await db.prepare('DELETE FROM mission_results WHERE campaign=? AND user_sub=? AND provider=?').run(campaign, sub, provider);
        await db.prepare('DELETE FROM mission_oauth_challenges WHERE user_sub=? AND provider=?').run(sub, provider);
      }).immediate();
    },
    async saveResult(campaign, sub, provider, result) {
      const payload = JSON.stringify(result),
        checkedAt = Date.now();
      await db.transaction(async () => {
        assertSurfCampaignOpen(campaign);
        if (identityLocks[provider] && result.outcome === 'verified') {
          const identity = await db.prepare('SELECT user_id FROM mission_connections WHERE campaign=? AND user_sub=? AND provider=?').get(campaign, sub, provider);
          if (!identity) throw new HttpError(409, 'connection_required');
          await identityLocks[provider].lock(campaign, sub, identity.user_id, result.checkedAt || new Date(checkedAt).toISOString());
        }
        await db.prepare(`INSERT INTO mission_results VALUES(?,?,?,?,?,?) ON CONFLICT(campaign,rule_version,user_sub,provider)
          DO UPDATE SET result_json=excluded.result_json,checked_at=excluded.checked_at`).run(campaign, MISSION_RULE_VERSION, sub, provider, payload, checkedAt);
        await db.prepare(`INSERT INTO mission_result_history(campaign,rule_version,user_sub,provider,result_json,checked_at)
          VALUES(?,?,?,?,?,?)`).run(campaign, MISSION_RULE_VERSION, sub, provider, payload, checkedAt);
      }).immediate();
    },
    async getResult(campaign, sub, provider) {
      const row = await db.prepare('SELECT * FROM mission_results WHERE campaign=? AND rule_version=? AND user_sub=? AND provider=?').get(campaign, MISSION_RULE_VERSION, sub, provider);
      if (!row) return null;
      const {
        evidence: _evidence,
        ...result
      } = JSON.parse(row.result_json);
      return {
        ...result,
        stale: row.checked_at + RESULT_MAX_AGE_MS <= Date.now()
      };
    },
    async acquire(campaign, sub, provider, purpose = 'verify') {
      assertSurfCampaignOpen(campaign);
      const operationKey = JSON.stringify([campaign, sub, provider, purpose]),
        owner = randomBytes(24).toString('hex'),
        now = Date.now();
      const acquired = await db.prepare(`INSERT INTO mission_operation_leases VALUES(?,?,?,?) ON CONFLICT(operation_key) DO UPDATE
        SET owner=excluded.owner,expires_at=excluded.expires_at,next_check_at=excluded.next_check_at
        WHERE mission_operation_leases.expires_at<=? AND mission_operation_leases.next_check_at<=?`).run(operationKey, owner, now + OPERATION_LEASE_MS, now + 10_000, now, now);
      if (!acquired.changes) throw new HttpError(429, 'mission_check_busy');
      return async () => await db.prepare('UPDATE mission_operation_leases SET expires_at=0 WHERE operation_key=? AND owner=?').run(operationKey, owner);
    }
  };
}
