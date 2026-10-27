import { readFile } from 'node:fs/promises';
import { getPool, transaction } from '../server/postgres/database.mjs';
import { loadLocalEnv } from '../server/env-loader.mjs';

loadLocalEnv();
if (process.env.MERCH_RUNTIME_CONFIG) Object.assign(process.env,
  JSON.parse(await readFile(process.env.MERCH_RUNTIME_CONFIG, 'utf8')));
const runtimeUrl = new URL(process.env.MERCH_DATABASE_URL);
const applicationRole = decodeURIComponent(runtimeUrl.username);
if (!/^[a-z_][a-z0-9_]*$/.test(applicationRole)) throw new Error('invalid_application_role');
// Administrative credentials are explicit and used only in this operator process.
// Never give the deployed application schema-creation permissions.
if (process.env.MERCH_MIGRATION_DATABASE_URL_FILE) {
  const ownerUrl = new URL((await readFile(process.env.MERCH_MIGRATION_DATABASE_URL_FILE, 'utf8')).trim());
  if (ownerUrl.hostname.replace('-pooler', '') !== runtimeUrl.hostname.replace('-pooler', '') ||
      ownerUrl.pathname !== runtimeUrl.pathname) throw new Error('migration_database_target_mismatch');
  // Schema changes use the direct endpoint; the deployed app keeps its pooler URL.
  ownerUrl.hostname = ownerUrl.hostname.replace('-pooler.', '.');
  process.env.MERCH_DATABASE_URL = ownerUrl.href;
}
const migrations = ['20261020-surf-store-claims.sql', '20261021-surf-store-email.sql', '20261027-surf-store-restock.sql'];
const statements = await Promise.all(migrations.map(name =>
  readFile(new URL(`../server/postgres/migrations/${name}`, import.meta.url), 'utf8')));
try {
  await transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['merch-schema:surf-store-20261020']);
    for (const sql of statements) await client.query(sql);
    await client.query(`GRANT SELECT, INSERT ON TABLE public.surf_store_claims TO ${applicationRole}`);
  });
  console.log('Surf store claims, email validation and timed restock constraints are ready. Existing data was not modified.');
} finally { await getPool().end(); }
