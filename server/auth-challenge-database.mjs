import { randomBytes } from 'node:crypto';
import { getMerchDatabase } from './merch-database.mjs';
import { sessionIdHash } from './auth-session-database.mjs';
import { createSecretBox } from './auth-secret-box.mjs';

export function createAuthChallengeStore(db = getMerchDatabase(), secretBox = createSecretBox()) {
  db.exec(`CREATE TABLE IF NOT EXISTS renaiss_oauth_challenges (
    id_hash TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER NOT NULL
  )`);
  return {
    save(challenge, maxAgeMs) {
      const id = randomBytes(32).toString('base64url'), hash = sessionIdHash(id);
      db.prepare('DELETE FROM renaiss_oauth_challenges WHERE expires_at<=?').run(Date.now());
      db.prepare('INSERT INTO renaiss_oauth_challenges VALUES(?,?,?)').run(hash, secretBox.seal(challenge, hash), Date.now() + maxAgeMs);
      return id;
    },
    take(id) {
      if (!id) return null;
      const hash = sessionIdHash(id);
      const row = db.prepare('DELETE FROM renaiss_oauth_challenges WHERE id_hash=? AND expires_at>? RETURNING payload').get(hash, Date.now());
      return row ? secretBox.unseal(row.payload, hash) : null;
    },
  };
}
