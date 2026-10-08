import { HttpError } from '../http.mjs';

const initialized = new WeakMap();

// Lock the first successfully verified provider ID, independently of token
// freshness or the latest check result. Both social tasks use the same rule.
export function createSocialIdentityLock(db, provider) {
  if (!['x', 'discord'].includes(provider)) throw new TypeError('Unknown social provider');
  db.exec(`CREATE TABLE IF NOT EXISTS mission_social_identity_locks (
    campaign TEXT NOT NULL, user_sub TEXT NOT NULL, provider TEXT NOT NULL,
    user_id TEXT NOT NULL, verified_at TEXT NOT NULL,
    PRIMARY KEY(campaign,user_sub,provider)
  )`);
  const select = db.prepare(`SELECT user_id AS userId, verified_at AS verifiedAt
    FROM mission_social_identity_locks WHERE campaign=? AND user_sub=? AND provider=?`);
  const insert = db.prepare('INSERT OR IGNORE INTO mission_social_identity_locks VALUES(?,?,?,?,?)');
  const read = (campaign, sub) => select.get(campaign, sub, provider) || null;
  const lockedError = `${provider}_verified_account_locked`;
  function assertIdentity(campaign, sub, userId) {
    const locked = read(campaign, sub);
    if (locked && locked.userId !== userId) throw new HttpError(409, lockedError);
  }
  const providers = initialized.get(db) || new Set();
  if (!providers.has(provider)) {
    db.transaction(() => {
      // Preserve existing X locks before upgrading provider history. The legacy
      // table remains intact so no existing audit record is removed.
      const hasTable = name => db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
      if (provider === 'x' && hasTable('mission_x_identity_locks')) {
        for (const row of db.prepare('SELECT * FROM mission_x_identity_locks').all())
          insert.run(row.campaign, row.user_sub, provider, row.user_id, row.verified_at);
      }
      const rows = db.prepare(`SELECT campaign,user_sub,result_json,checked_at FROM mission_result_history WHERE provider=?
        UNION ALL SELECT campaign,user_sub,result_json,checked_at FROM mission_results WHERE provider=?
        ORDER BY checked_at`).all(provider, provider);
      const candidates = [];
      for (const row of rows) {
        const result = JSON.parse(row.result_json);
        // Discord previously allowed replacement. Upgrade the identity actually
        // connected now, rather than locking a different historical account.
        if (provider === 'discord') {
          const connection = db.prepare('SELECT user_id FROM mission_connections WHERE campaign=? AND user_sub=? AND provider=?')
            .get(row.campaign, row.user_sub, provider);
          if (connection && connection.user_id !== result.evidence?.userId) continue;
        }
        if (result.outcome === 'verified' && typeof result.evidence?.userId === 'string' && /^\d+$/.test(result.evidence.userId))
          candidates.push([row.campaign, row.user_sub, result.evidence.userId, result.checkedAt || new Date(row.checked_at).toISOString()]);
      }
      if (hasTable('mission_participants')) {
        const column = provider === 'x' ? 'x_user_id' : 'discord_user_id';
        for (const row of db.prepare(`SELECT campaign,user_sub,${column} AS user_id,tasks_json FROM mission_participants WHERE ${column} IS NOT NULL`).all()) {
          const task = JSON.parse(row.tasks_json)[provider];
          if (provider === 'discord') {
            const connection = db.prepare('SELECT user_id FROM mission_connections WHERE campaign=? AND user_sub=? AND provider=?')
              .get(row.campaign, row.user_sub, provider);
            if (connection && connection.user_id !== row.user_id) continue;
          }
          if (task?.verified && task.verifiedAt && /^\d+$/.test(row.user_id))
            candidates.push([row.campaign, row.user_sub, row.user_id, task.verifiedAt]);
        }
      }
      candidates.sort((a, b) => Date.parse(a[3]) - Date.parse(b[3]));
      for (const [campaign, sub, userId, verifiedAt] of candidates)
        insert.run(campaign, sub, provider, userId, verifiedAt);
    }).immediate();
    providers.add(provider);
    initialized.set(db, providers);
  }
  return {
    read,
    assertIdentity,
    lock(campaign, sub, userId, verifiedAt) {
      assertIdentity(campaign, sub, userId);
      insert.run(campaign, sub, provider, userId, verifiedAt);
    },
    assertDisconnectAllowed(campaign, sub) {
      if (read(campaign, sub)) throw new HttpError(409, lockedError);
    },
  };
}
