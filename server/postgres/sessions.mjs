import { createHash, randomBytes } from "node:crypto";
import { createSecretBox } from "../auth-secret-box.mjs";
import { getPool, sqlTables } from "./database.mjs";

export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const CHALLENGE_SECONDS = 600;

export function sessionStore(
  database = getPool(),
  secretBox = createSecretBox(),
  schema = "public",
) {
  const tables = sqlTables(schema);
  return {
    async create(user) {
      await database.query(
        `DELETE FROM ${tables.renaiss_identity_sessions} WHERE expires_at<=$1`,
        [Date.now()],
      );
      const id = randomBytes(32).toString("base64url");
      const session = {
        user,
        createdAt: new Date().toISOString(),
        expiresAt: Date.now() + SESSION_SECONDS * 1000,
      };
      await database.query(
        `INSERT INTO ${tables.renaiss_identity_sessions} (id_hash,user_json,created_at,expires_at) VALUES($1,$2,$3,$4)`,
        [hash(id), JSON.stringify(user), session.createdAt, session.expiresAt],
      );
      return { id, session };
    },
    async read(id) {
      if (!id) return null;
      const {
        rows: [row],
      } = await database.query(
        `SELECT * FROM ${tables.renaiss_identity_sessions} WHERE id_hash=$1 AND expires_at>$2`,
        [hash(id), Date.now()],
      );
      if (!row) return null;
      const user = JSON.parse(row.user_json);
      // Production Store rules apply in the isolated production-mode build too.
      if (user.isDemo) return null;
      return {
        user,
        createdAt: row.created_at,
        expiresAt: Number(row.expires_at),
      };
    },
    async remove(id) {
      if (id)
        await database.query(
          `DELETE FROM ${tables.renaiss_identity_sessions} WHERE id_hash=$1`,
          [hash(id)],
        );
    },
    async saveChallenge(payload) {
      await database.query(
        `DELETE FROM ${tables.renaiss_oauth_challenges} WHERE expires_at<=$1`,
        [Date.now()],
      );
      const id = randomBytes(32).toString("base64url"),
        key = hash(id);
      await database.query(
        `INSERT INTO ${tables.renaiss_oauth_challenges} (id_hash,payload,expires_at) VALUES($1,$2,$3)`,
        [
          key,
          secretBox.seal(payload, key),
          Date.now() + CHALLENGE_SECONDS * 1000,
        ],
      );
      return id;
    },
    async takeChallenge(id) {
      if (!id) return null;
      const key = hash(id);
      // Atomic consume across concurrent serverless instances.
      const {
        rows: [row],
      } = await database.query(
        `DELETE FROM ${tables.renaiss_oauth_challenges} WHERE id_hash=$1 AND expires_at>$2 RETURNING payload`,
        [key, Date.now()],
      );
      return row ? secretBox.unseal(row.payload, key) : null;
    },
  };
}
