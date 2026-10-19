import { HttpError } from '../http.mjs';

// Historical locks are migrated once with the source snapshot, never rebuilt
// per request. Conflict checks and insertion share the caller's transaction.
export function createSocialIdentityLock(db, provider) {
  if (!['x', 'discord'].includes(provider)) throw new TypeError('Unknown social provider');
  const read = async (campaign, sub) => (await db.prepare(`SELECT user_id AS userId, verified_at AS verifiedAt
    FROM mission_social_identity_locks WHERE campaign=? AND user_sub=? AND provider=?`).get(campaign, sub, provider)) || null;
  const lockedError = `${provider}_verified_account_locked`;
  async function assertIdentity(campaign, sub, userId) {
    const locked = await read(campaign, sub);
    if (locked && locked.userId !== userId) throw new HttpError(409, lockedError);
  }
  return {
    read,
    assertIdentity,
    async lock(campaign, sub, userId, verifiedAt) {
      await assertIdentity(campaign, sub, userId);
      await db.prepare('INSERT INTO mission_social_identity_locks VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING').run(campaign, sub, provider, userId, verifiedAt);
      await assertIdentity(campaign, sub, userId);
    },
    async assertDisconnectAllowed(campaign, sub) {
      if (await read(campaign, sub)) throw new HttpError(409, lockedError);
    }
  };
}
