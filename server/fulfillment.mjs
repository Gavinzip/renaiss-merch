import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { HttpError } from './http.mjs';
import { getClaimDatabasePath } from './runtime-config.mjs';
import { readStoredShippingClaims } from './shipping-claims.mjs';
import { readStoredVipTicketClaims } from './vip-ticket-claims.mjs';

const dbByPath = new Map();
const fulfillmentProductIds = new Set(['shirt', 'bracelet', 'ticket']);

export function readFulfillmentOverview(options = {}) {
  const recipients = readFulfillmentRecipients(options);
  const exports = readFulfillmentExports(options);
  const lastExport = exports[0] || null;

  return {
    completedRecipientCount: recipients.length,
    completedRecipientCounts: {
      shirt: countRecipients(recipients, 'shirt'),
      bracelet: countRecipients(recipients, 'bracelet'),
      ticket: countRecipients(recipients, 'ticket')
    },
    lastExport,
    previousExportRecipientCount: lastExport?.recipientCount ?? null,
    exports
  };
}

export function createFulfillmentExport(options = {}) {
  const productId = readExportProductId(options.productId);
  const recipients = readFulfillmentRecipients(options).filter((recipient) => {
    return productId === null || recipient.productId === productId;
  });
  const createdAt = new Date().toISOString();
  const exportRecord = {
    id: randomUUID(),
    createdAt,
    productId,
    recipientCount: recipients.length
  };
  const db = getFulfillmentDb(options.dbPath);

  try {
    db.prepare(
      `
        INSERT INTO fulfillment_exports (id, created_at, product_id, recipient_count)
        VALUES (@id, @createdAt, @productId, @recipientCount)
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
  const latestSubmittedByWalletAndProduct = new Map();

  const claims = [
    ...readStoredShippingClaims(options),
    ...readStoredVipTicketClaims(options)
  ];

  for (const claim of claims) {
    if (claim.status !== 'submitted') {
      continue;
    }

    const walletAddress = normalizeWalletAddress(claim.eligibility?.walletAddress);

    if (!walletAddress) {
      throw new HttpError(500, 'fulfillment_recipient_wallet_invalid');
    }

    const productId = readRecipientProductId(claim.productId);
    latestSubmittedByWalletAndProduct.set(
      `${walletAddress}:${productId}`,
      claim
    );
  }

  return [...latestSubmittedByWalletAndProduct.values()].sort((left, right) => {
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
        SELECT id, created_at, product_id, recipient_count
        FROM fulfillment_exports
        ORDER BY created_at DESC, rowid DESC
        LIMIT 50
      `
    )
    .all()
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      productId: readStoredExportProductId(row.product_id),
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
        product_id TEXT,
        recipient_count INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_fulfillment_exports_created_at
        ON fulfillment_exports (created_at);
    `);
    const exportColumns = db.pragma('table_info(fulfillment_exports)');

    if (!exportColumns.some((column) => column.name === 'product_id')) {
      db.exec('ALTER TABLE fulfillment_exports ADD COLUMN product_id TEXT');
    }
  } catch (error) {
    db.close();
    throw new HttpError(500, 'fulfillment_database_unavailable', String(error));
  }

  dbByPath.set(dbPath, db);

  return db;
}

function countRecipients(recipients, productId) {
  return recipients.filter((recipient) => recipient.productId === productId).length;
}

function readExportProductId(value) {
  if (value === undefined || value === null || value === 'all') {
    return null;
  }

  if (!fulfillmentProductIds.has(value)) {
    throw new HttpError(400, 'fulfillment_product_invalid');
  }

  return value;
}

function readStoredExportProductId(value) {
  if (value === null) {
    return null;
  }

  if (!fulfillmentProductIds.has(value)) {
    throw new HttpError(500, 'fulfillment_export_product_invalid');
  }

  return value;
}

function readRecipientProductId(value) {
  if (!fulfillmentProductIds.has(value)) {
    throw new HttpError(500, 'fulfillment_recipient_product_invalid');
  }

  return value;
}

function buildFulfillmentCsv(recipients) {
  const columns = [
    ['productId', 'Product'],
    ['walletAddress', 'Wallet address'],
    ['submittedAt', 'Submitted at'],
    ['firstName', 'First name'],
    ['lastName', 'Last name'],
    ['email', 'Email'],
    ['phone', 'Phone'],
    ['size', 'Size'],
    ['color', 'Color'],
    ['country', 'Country'],
    ['deliveryMethod', 'Delivery method'],
    ['sevenElevenStoreId', '7-ELEVEN store ID'],
    ['sevenElevenStoreName', '7-ELEVEN store name'],
    ['sevenElevenStoreAddress', '7-ELEVEN store address'],
    ['sevenElevenStoreOutside', '7-ELEVEN outside-island store'],
    ['region', 'State / region'],
    ['city', 'City'],
    ['postalCode', 'Postal code'],
    ['addressLine1', 'Address line 1'],
    ['addressLine2', 'Address line 2'],
    ['deliveryNotes', 'Delivery notes']
  ];
  const lines = [columns.map(([, label]) => csvCell(label)).join(',')];

  for (const claim of recipients) {
    const shipping = readRecipientShipping(claim.shipping);
    const walletAddress = normalizeWalletAddress(
      claim.eligibility?.walletAddress
    );

    if (!walletAddress) {
      throw new HttpError(500, 'fulfillment_recipient_wallet_invalid');
    }

    const values = {
      ...shipping,
      productId: readRecipientProductId(claim.productId),
      submittedAt: claim.submittedAt || claim.createdAt,
      walletAddress
    };

    lines.push(columns.map(([key]) => csvCell(values[key])).join(','));
  }

  return `\ufeff${lines.join('\r\n')}\r\n`;
}

function readRecipientShipping(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(500, 'fulfillment_recipient_shipping_invalid');
  }

  return value;
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
