import { HttpError } from '../http.mjs';

const initialized = new WeakSet();

// A successful X check locks the provider user ID for this campaign. Token
// renewal may reconnect that identity; losing freshness never unlocks it.
export function createXIdentityLock(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS mission_x_identity_locks (
    campaign TEXT NOT NULL, user_sub TEXT NOT NULL, user_id TEXT NOT NULL,
    verified_at TEXT NOT NULL, PRIMARY KEY(campaign,user_sub)
  )`);
  const select = db.prepare('SELECT user_id AS userId, verified_at AS verifiedAt FROM mission_x_identity_locks WHERE campaign=? AND user_sub=?');
  const insert = db.prepare('INSERT OR IGNORE INTO mission_x_identity_locks VALUES(?,?,?,?)');
  function assertIdentity(campaign, sub, userId) {
    const locked = select.get(campaign, sub);
    if (locked && locked.userId !== userId) throw new HttpError(409, 'x_verified_account_locked');
  }
  if (!initialized.has(db)) {
    db.transaction(() => {
      // Upgrade existing successful provider evidence before any new check can
      // overwrite the latest result. History supplies the first verified ID.
      const rows = db.prepare(`SELECT campaign,user_sub,result_json,checked_at FROM mission_result_history WHERE provider='x'
        UNION ALL SELECT campaign,user_sub,result_json,checked_at FROM mission_results WHERE provider='x'
        ORDER BY checked_at`).all();
      const candidates = [];
      for (const row of rows) {
        const result = JSON.parse(row.result_json);
        if (result.outcome === 'verified' && typeof result.evidence?.userId === 'string' && /^\d+$/.test(result.evidence.userId))
          candidates.push([row.campaign, row.user_sub, result.evidence.userId, result.checkedAt || new Date(row.checked_at).toISOString()]);
      }
      if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='mission_participants'").get()) {
        for (const row of db.prepare('SELECT campaign,user_sub,x_user_id,tasks_json FROM mission_participants WHERE x_user_id IS NOT NULL').all()) {
          const task = JSON.parse(row.tasks_json).x;
          if (task?.verified && task.verifiedAt && /^\d+$/.test(row.x_user_id))
            candidates.push([row.campaign, row.user_sub, row.x_user_id, task.verifiedAt]);
        }
      }
      candidates.sort((a, b) => Date.parse(a[3]) - Date.parse(b[3]));
      for (const candidate of candidates) insert.run(...candidate);
    })();
    initialized.add(db);
  }
  return {
    read: (campaign, sub) => select.get(campaign, sub) || null,
    assertIdentity,
    lock(campaign, sub, userId, verifiedAt) {
      assertIdentity(campaign, sub, userId);
      insert.run(campaign, sub, userId, verifiedAt);
    },
    assertDisconnectAllowed(campaign, sub) {
      if (select.get(campaign, sub)) throw new HttpError(409, 'x_verified_account_locked');
    },
  };
}
