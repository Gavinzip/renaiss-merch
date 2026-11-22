import { readFile } from "node:fs/promises";
import {
  createDatabasePool,
  transaction,
} from "../server/postgres/database.mjs";
import { loadLocalEnv } from "../server/env-loader.mjs";
loadLocalEnv();
if (process.env.MERCH_RUNTIME_CONFIG)
  Object.assign(
    process.env,
    JSON.parse(await readFile(process.env.MERCH_RUNTIME_CONFIG, "utf8")),
  );
const runtime = new URL(process.env.FIELD_DRAW_DATABASE_URL);
const role = decodeURIComponent(runtime.username);
if (!/^[a-z_][a-z0-9_]*$/.test(role))
  throw new Error("invalid_application_role");
if (!process.env.FIELD_DRAW_MIGRATION_DATABASE_URL_FILE)
  throw new Error("field_draw_migration_owner_required");
const owner = new URL(
  (
    await readFile(process.env.FIELD_DRAW_MIGRATION_DATABASE_URL_FILE, "utf8")
  ).trim(),
);
if (
  owner.hostname.replace("-pooler", "") !==
    runtime.hostname.replace("-pooler", "") ||
  owner.port !== runtime.port ||
  owner.pathname !== runtime.pathname
)
  throw new Error("migration_database_target_mismatch");
const pool = createDatabasePool(owner.href);
try {
  const sql = await readFile(
    new URL(
      "../server/postgres/migrations/20261122-field-draw.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      "merch-schema:field-draw-20261122",
    ]);
    await client.query(sql);
    await client.query(`GRANT USAGE ON SCHEMA field_draw TO ${role}`);
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA field_draw TO ${role}`,
    );
    await client.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA field_draw TO ${role}`,
    );
  }, pool);
  console.log(
    "Independent field-draw schema ready; existing activity data was not modified.",
  );
} finally {
  await pool.end();
}
