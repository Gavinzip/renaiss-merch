import { createHash, randomUUID } from 'node:crypto';
import { getWorkflowDatabase as getMerchDatabase } from '../postgres/statements.mjs';
const WINDOW_MS = 60_000;
const REQUEST_LIMIT = 300;

// Coordinate the partner quota and upstream Retry-After across local sessions
// and Node processes using the same persistent database.
export function createSurfRateStore(db = getMerchDatabase()) {
  const keyHash = key => createHash('sha256').update(key).digest('hex');
  return {
    async reserve(partnerKey, now = Date.now()) {
      return await db.transaction(async () => {
        const hash = keyHash(partnerKey);
        await db.prepare('DELETE FROM surf_registration_requests WHERE requested_at <= ?').run(now - WINDOW_MS);
        await db.prepare('DELETE FROM surf_registration_backoff WHERE retry_at <= ?').run(now);
        const backoff = await db.prepare('SELECT retry_at FROM surf_registration_backoff WHERE key_hash=?').get(hash);
        if (backoff) return Math.max(1, Math.ceil((backoff.retry_at - now) / 1000));
        const window = await db.prepare('SELECT count(*) AS count, min(requested_at) AS oldest FROM surf_registration_requests WHERE key_hash=?').get(hash);
        if (window.count >= REQUEST_LIMIT) return Math.max(1, Math.ceil((window.oldest + WINDOW_MS - now) / 1000));
        await db.prepare('INSERT INTO surf_registration_requests VALUES(?,?,?)').run(randomUUID(), hash, now);
        return null;
      }).immediate();
    },
    async defer(partnerKey, seconds, now = Date.now()) {
      if (!Number.isSafeInteger(seconds) || seconds < 1) return;
      const retryAt = now + seconds * 1000;
      if (!Number.isSafeInteger(retryAt)) return;
      await db.prepare(`INSERT INTO surf_registration_backoff VALUES(?,?) ON CONFLICT(key_hash)
        DO UPDATE SET retry_at=GREATEST(surf_registration_backoff.retry_at,excluded.retry_at)`).run(keyHash(partnerKey), retryAt);
    }
  };
}
