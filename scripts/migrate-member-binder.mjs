import { readFile } from 'node:fs/promises';
import { loadLocalEnv } from '../server/env-loader.mjs';
import { getPool, transaction } from '../server/postgres/database.mjs';

loadLocalEnv();
if (process.env.MERCH_RUNTIME_CONFIG) Object.assign(process.env,
  JSON.parse(await readFile(process.env.MERCH_RUNTIME_CONFIG, 'utf8')));
const target = new URL(process.env.MERCH_DATABASE_URL);
const role = decodeURIComponent(target.username);
if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error('invalid_application_role');
if (process.env.MERCH_MIGRATION_DATABASE_URL_FILE) {
  const owner = new URL((await readFile(process.env.MERCH_MIGRATION_DATABASE_URL_FILE, 'utf8')).trim());
  if (owner.hostname.replace('-pooler.', '.') !== target.hostname.replace('-pooler.', '.') || owner.pathname !== target.pathname) {
    throw new Error('migration_database_target_mismatch');
  }
  process.env.MERCH_DATABASE_URL = owner.href;
}
try {
  const sql = await readFile(new URL('../server/postgres/migrations/20261023-member-binders.sql', import.meta.url), 'utf8');
  await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('merch-schema:member-binder-20261023'))");
    await client.query(sql);
    await client.query(`GRANT SELECT, INSERT, UPDATE ON public.member_binders TO ${role}`);
  });
  console.log('Member binder schema ready.');
} finally { await getPool().end(); }
