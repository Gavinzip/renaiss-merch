import { createHash, randomUUID } from 'node:crypto';
import { getMerchDatabase } from '../merch-database.mjs';

const WINDOW_MS = 60_000;
const REQUEST_LIMIT = 300;

// Coordinate the partner quota and upstream Retry-After across local sessions
// and Node processes using the same persistent database.
export function createSurfRateStore(db = getMerchDatabase()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS surf_registration_requests (
      id TEXT PRIMARY KEY, key_hash TEXT NOT NULL, requested_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS surf_requests_window ON surf_registration_requests (key_hash, requested_at);
    CREATE TABLE IF NOT EXISTS surf_registration_backoff (
      key_hash TEXT PRIMARY KEY, retry_at INTEGER NOT NULL
    );
  `);
  const keyHash = key => createHash('sha256').update(key).digest('hex');
  return {
    reserve(partnerKey, now = Date.now()) {
      return db.transaction(() => {
        const hash = keyHash(partnerKey);
        db.prepare('DELETE FROM surf_registration_requests WHERE requested_at <= ?').run(now - WINDOW_MS);
        db.prepare('DELETE FROM surf_registration_backoff WHERE retry_at <= ?').run(now);
        const backoff = db.prepare('SELECT retry_at FROM surf_registration_backoff WHERE key_hash=?').get(hash);
        if (backoff) return Math.max(1, Math.ceil((backoff.retry_at - now) / 1000));
        const window = db.prepare('SELECT count(*) AS count, min(requested_at) AS oldest FROM surf_registration_requests WHERE key_hash=?').get(hash);
        if (window.count >= REQUEST_LIMIT) return Math.max(1, Math.ceil((window.oldest + WINDOW_MS - now) / 1000));
        db.prepare('INSERT INTO surf_registration_requests VALUES(?,?,?)').run(randomUUID(), hash, now);
        return null;
      }).immediate();
    },
    defer(partnerKey, seconds, now = Date.now()) {
      if (!Number.isSafeInteger(seconds) || seconds < 1) return;
      const retryAt = now + seconds * 1000;
      if (!Number.isSafeInteger(retryAt)) return;
      db.prepare(`INSERT INTO surf_registration_backoff VALUES(?,?) ON CONFLICT(key_hash)
        DO UPDATE SET retry_at=max(retry_at,excluded.retry_at)`).run(keyHash(partnerKey), retryAt);
    },
  };
}
