import { createHash } from 'node:crypto';
import { getMerchDatabase } from './merch-database.mjs';

// Persist Renaiss identity sessions so a social callback still recognizes the
// participant after a Node restart. Cookies contain random IDs, not user data.
export function authSessionDatabase() {
  const db = getMerchDatabase();
  db.exec(`CREATE TABLE IF NOT EXISTS renaiss_identity_sessions (
    id_hash TEXT PRIMARY KEY, user_json TEXT NOT NULL, created_at TEXT NOT NULL, expires_at INTEGER NOT NULL
  )`);
  return db;
}
export const sessionIdHash = id => createHash('sha256').update(id).digest('hex');
