import { randomUUID } from 'node:crypto';
import { getWorkflowDatabase } from './postgres/statements.mjs';
import { HttpError } from './http.mjs';

const fulfillmentProductIds = new Set(['shirt', 'bracelet', 'ticket']);

export async function readFulfillmentOverview(options = {}) {
  const recipients = await readFulfillmentRecipients(options);
  const exports = await readFulfillmentExports(options);
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

export async function createFulfillmentExport(options = {}) {
  const productId = readExportProductId(options.productId);
  const recipients = (await readFulfillmentRecipients(options)).filter((recipient) => {
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
    await db.prepare(
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

async function readFulfillmentRecipients(options) {
  const latestSubmittedByWalletAndProduct = new Map();

  const claims = [
    ...await readStoredShippingClaims(options),
    ...await readStoredVipTicketClaims(options)
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

async function readFulfillmentExports(options) {
  const db = getFulfillmentDb(options.dbPath);

  return (await db
    .prepare(
      `
        SELECT id, created_at, product_id, recipient_count
        FROM fulfillment_exports
        ORDER BY created_at DESC, id DESC
        LIMIT 50
      `
    )
    .all())
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      productId: readStoredExportProductId(row.product_id),
      recipientCount: row.recipient_count
    }));
}

function getFulfillmentDb(options) {
  return getWorkflowDatabase();
}
async function readStoredShippingClaims() {
  return (await getFulfillmentDb().prepare('SELECT * FROM shipping_claims ORDER BY created_at,id').all()).map(row => ({
    id:row.id,createdAt:row.created_at,eligibility:JSON.parse(row.eligibility_json),productId:row.product_id,
    shipping:JSON.parse(row.shipping_json),status:row.claim_status,submittedAt:row.submitted_at,
  }));
}
async function readStoredVipTicketClaims() {
  return (await getFulfillmentDb().prepare('SELECT * FROM vip_ticket_claims ORDER BY submitted_at,id').all()).map(row => ({
    id:row.id,createdAt:row.created_at,eligibility:JSON.parse(row.eligibility_json),productId:row.product_id,
    shipping:{email:row.claim_email},status:'submitted',submittedAt:row.submitted_at,
  }));
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
