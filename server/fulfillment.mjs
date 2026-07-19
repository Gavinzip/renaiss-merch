import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { HttpError } from './http.mjs';
import { getClaimDatabasePath } from './runtime-config.mjs';
import { readStoredShippingClaims } from './shipping-claims.mjs';

const dbByPath = new Map();

export function readFulfillmentOverview(options = {}) {
  const recipients = readFulfillmentRecipients(options);
  const exports = readFulfillmentExports(options);
  const lastExport = exports[0] || null;

  return {
    completedRecipientCount: recipients.length,
    lastExport,
    previousExportRecipientCount: lastExport?.recipientCount ?? null,
    exports
  };
}

export function createFulfillmentExport(options = {}) {
  const recipients = readFulfillmentRecipients(options);
  const createdAt = new Date().toISOString();
  const exportRecord = {
    id: randomUUID(),
    createdAt,
    recipientCount: recipients.length
  };
  const db = getFulfillmentDb(options.dbPath);

  try {
    db.prepare(
      `
        INSERT INTO fulfillment_exports (id, created_at, recipient_count)
        VALUES (@id, @createdAt, @recipientCount)
      `
    ).run(exportRecord);
  } catch (error) {
    throw new HttpError(500, 'fulfillment_export_record_failed', String(error));
  }

  return {
    csv: buildFulfillmentCsv(recipients),
    exportRecord
  };
}

function readFulfillmentRecipients(options) {
  const latestSubmittedByWallet = new Map();

  for (const claim of readStoredShippingClaims(options)) {
    if (claim.status !== 'submitted') {
      continue;
    }

    const walletAddress = normalizeWalletAddress(claim.eligibility?.walletAddress);

    if (walletAddress) {
      latestSubmittedByWallet.set(walletAddress, claim);
    }
  }

  return [...latestSubmittedByWallet.values()].sort((left, right) => {
    return String(left.submittedAt || left.createdAt).localeCompare(
      String(right.submittedAt || right.createdAt)
    );
  });
}

function readFulfillmentExports(options) {
  const db = getFulfillmentDb(options.dbPath);

  return db
    .prepare(
      `
        SELECT id, created_at, recipient_count
        FROM fulfillment_exports
        ORDER BY created_at DESC, id DESC
        LIMIT 50
      `
    )
    .all()
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      recipientCount: row.recipient_count
    }));
}

function getFulfillmentDb(configuredPath) {
  const dbPath = getClaimDatabasePath(configuredPath);
  const cached = dbByPath.get(dbPath);

  if (cached) {
    return cached;
  }

  // Shipping claims initialize the shared database and its WAL settings.
  readStoredShippingClaims({ dbPath });
  const db = new Database(dbPath, { timeout: 5000 });

  try {
    db.pragma('busy_timeout = 5000');
    db.exec(`
      CREATE TABLE IF NOT EXISTS fulfillment_exports (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        recipient_count INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_fulfillment_exports_created_at
        ON fulfillment_exports (created_at);
    `);
  } catch (error) {
    db.close();
    throw new HttpError(500, 'fulfillment_database_unavailable', String(error));
  }

  dbByPath.set(dbPath, db);

  return db;
}

function buildFulfillmentCsv(recipients) {
  const columns = [
    ['walletAddress', 'Wallet address'],
    ['submittedAt', 'Submitted at'],
    ['firstName', 'First name'],
    ['lastName', 'Last name'],
    ['email', 'Email'],
    ['phone', 'Phone'],
    ['size', 'Size'],
    ['country', 'Country'],
    ['region', 'State / region'],
    ['city', 'City'],
    ['postalCode', 'Postal code'],
    ['addressLine1', 'Address line 1'],
    ['addressLine2', 'Address line 2'],
    ['deliveryNotes', 'Delivery notes']
  ];
  const lines = [columns.map(([, label]) => csvCell(label)).join(',')];

  for (const claim of recipients) {
    const shipping = claim.shipping || {};
    const values = {
      ...shipping,
      submittedAt: claim.submittedAt || claim.createdAt,
      walletAddress: claim.eligibility?.walletAddress || ''
    };

    lines.push(columns.map(([key]) => csvCell(values[key])).join(','));
  }

  return `\ufeff${lines.join('\r\n')}\r\n`;
}

function csvCell(value) {
  const text = String(value ?? '');
  const protectedText = /^[=+\-@]/.test(text) ? `'${text}` : text;

  return `"${protectedText.replaceAll('"', '""')}"`;
}

function normalizeWalletAddress(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const walletAddress = value.trim().toLowerCase();

  return /^0x[a-f0-9]{40}$/.test(walletAddress) ? walletAddress : null;
}
