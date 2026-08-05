import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { getClaimDatabasePath } from './runtime-config.mjs';
import { runShippingClaimEntitlementBackfillMigration } from './shipping-claim-entitlement-migration.mjs';
import { runShippingProfileBackfillMigration } from './shipping-profile-migration.mjs';

const SQLITE_BUSY_RETRY_LIMIT = 20;
const SQLITE_BUSY_RETRY_BASE_MS = 25;
const databaseByPath = new Map();

export function getMerchDatabase(configuredPath) {
  const databasePath = getClaimDatabasePath(configuredPath);
  const cachedDatabase = databaseByPath.get(databasePath);

  if (cachedDatabase) {
    return cachedDatabase;
  }

  mkdirSync(dirname(databasePath), { recursive: true });

  const database = new Database(databasePath, {
    timeout: 5000
  });

  runWithSqliteBusyRetry(() => {
    database.pragma('busy_timeout = 5000');
    database.pragma('journal_mode = WAL');
    database.pragma('synchronous = NORMAL');
    database.pragma('foreign_keys = ON');
    database.exec(`
      CREATE TABLE IF NOT EXISTS shipping_claims (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        product_id TEXT NOT NULL DEFAULT 'shirt',
        wallet_address TEXT NOT NULL,
        user_sub TEXT,
        user_email TEXT,
        sbt_balance INTEGER NOT NULL,
        sbt_badge_count INTEGER NOT NULL,
        minimum_sbt_balance INTEGER NOT NULL,
        sbt_contract TEXT NOT NULL,
        eligibility_source TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL,
        gmail TEXT,
        size TEXT,
        color TEXT,
        phone TEXT NOT NULL,
        country TEXT NOT NULL,
        address_line_1 TEXT NOT NULL,
        address_line_2 TEXT,
        city TEXT NOT NULL,
        region TEXT NOT NULL,
        postal_code TEXT NOT NULL,
        delivery_notes TEXT,
        claim_status TEXT NOT NULL DEFAULT 'draft',
        submitted_at TEXT,
        eligibility_json TEXT NOT NULL,
        shipping_json TEXT NOT NULL,
        user_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS shipping_profiles (
        user_sub TEXT PRIMARY KEY,
        wallet_address TEXT,
        profile_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS merch_data_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS merch_access_checks (
        wallet_address TEXT NOT NULL,
        product_id TEXT NOT NULL,
        user_sub TEXT,
        status TEXT NOT NULL,
        checked_at TEXT NOT NULL,
        eligibility_json TEXT NOT NULL,
        PRIMARY KEY (wallet_address, product_id)
      );

      CREATE TABLE IF NOT EXISTS merch_product_entitlements (
        wallet_address TEXT NOT NULL,
        product_id TEXT NOT NULL,
        source_claim_id TEXT NOT NULL,
        source TEXT NOT NULL,
        granted_at TEXT NOT NULL,
        eligibility_json TEXT NOT NULL,
        PRIMARY KEY (wallet_address, product_id)
      );

      CREATE INDEX IF NOT EXISTS idx_shipping_claims_wallet_created_at
        ON shipping_claims (wallet_address, created_at);

      CREATE INDEX IF NOT EXISTS idx_shipping_claims_created_at
        ON shipping_claims (created_at);

      CREATE INDEX IF NOT EXISTS idx_merch_access_checks_user_sub
        ON merch_access_checks (user_sub);

      CREATE INDEX IF NOT EXISTS idx_merch_product_entitlements_source_claim
        ON merch_product_entitlements (source_claim_id);
    `);

    ensureColumn(database, 'shipping_claims', 'size', 'size TEXT');
    ensureColumn(database, 'shipping_claims', 'color', 'color TEXT');
    ensureColumn(
      database,
      'shipping_claims',
      'product_id',
      "product_id TEXT NOT NULL DEFAULT 'shirt'"
    );
    ensureColumn(
      database,
      'shipping_claims',
      'claim_status',
      "claim_status TEXT NOT NULL DEFAULT 'draft'"
    );
    ensureColumn(
      database,
      'shipping_claims',
      'submitted_at',
      'submitted_at TEXT'
    );
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_shipping_claims_wallet_product_created_at
        ON shipping_claims (wallet_address, product_id, created_at);
    `);
    runShippingClaimEntitlementBackfillMigration(database);
    runShippingProfileBackfillMigration(database);
  });

  databaseByPath.set(databasePath, database);
  return database;
}

export function runWithSqliteBusyRetry(operation) {
  for (let attempt = 0; attempt <= SQLITE_BUSY_RETRY_LIMIT; attempt += 1) {
    try {
      return operation();
    } catch (error) {
      if (!isSqliteBusy(error) || attempt === SQLITE_BUSY_RETRY_LIMIT) {
        throw error;
      }

      sleepSync(SQLITE_BUSY_RETRY_BASE_MS * (attempt + 1));
    }
  }
}

function ensureColumn(database, tableName, columnName, columnDefinition) {
  const columns = database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((column) => column.name);

  if (!columns.includes(columnName)) {
    database.exec(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`
    );
  }
}

function isSqliteBusy(error) {
  return error?.code === 'SQLITE_BUSY' || error?.code === 'SQLITE_LOCKED';
}

function sleepSync(durationMs) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, durationMs);
}
