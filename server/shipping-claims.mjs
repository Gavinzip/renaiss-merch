import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { readMerchEligibility } from './eligibility.mjs';
import { HttpError, sendJson } from './http.mjs';
import { getClaimDatabasePath } from './runtime-config.mjs';

const MAX_REQUEST_BODY_BYTES = 16 * 1024;
const SQLITE_BUSY_RETRY_LIMIT = 20;
const SQLITE_BUSY_RETRY_BASE_MS = 25;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const countryPattern = /^[A-Z]{2}$/;
const phonePattern = /^[+()\d\s.-]{6,32}$/;
const sizePattern = /^(S|M|L|XL)$/;
const walletPattern = /^0x[a-fA-F0-9]{40}$/;
const dbByPath = new Map();

export function handleStoredMerchShippingClaim(res, session, options = {}) {
  if (!session) {
    throw new HttpError(401, 'unauthenticated');
  }

  sendJson(res, 200, readLatestShippingClaim(session, options.readOptions));
}

export async function handleMerchShippingClaim(req, res, session, options = {}) {
  if (!session) {
    throw new HttpError(401, 'unauthenticated');
  }

  const readEligibility = options.readEligibility || readMerchEligibility;
  const writeShippingClaim = options.saveShippingClaim || saveShippingClaim;
  const eligibility = await readEligibility(session);

  if (eligibility.status !== 'eligible') {
    throw new HttpError(403, 'wallet_not_eligible');
  }

  const payload = await readJsonBody(req);
  const intent = readShippingIntent(payload.intent);
  const shipping = normalizeShippingPayload(payload.shipping || payload);
  const claim = writeShippingClaim(
    {
      eligibility,
      intent,
      shipping,
      user: sanitizeUser(session.user)
    },
    options.saveOptions
  );

  sendJson(res, 201, {
    hasSubmitted: hasSubmittedClaim(session, options.saveOptions),
    claimId: claim.id,
    savedAt: claim.createdAt,
    status: claim.status,
    submittedAt: claim.submittedAt
  });
}

export function saveShippingClaim(claimInput, options = {}) {
  const db = getShippingClaimsDb(options.dbPath);
  const createdAt = new Date().toISOString();
  const status = claimInput.intent === 'submit' ? 'submitted' : 'draft';
  const walletAddress = normalizeWalletAddress(
    claimInput.eligibility?.walletAddress
  );

  if (!walletAddress) {
    throw new HttpError(409, 'safe_wallet_not_ready');
  }

  const claim = {
    id: randomUUID(),
    createdAt,
    eligibility: {
      ...claimInput.eligibility,
      walletAddress
    },
    status,
    shipping: claimInput.shipping,
    submittedAt: status === 'submitted' ? createdAt : null,
    user: claimInput.user
  };
  const writeClaim = db.transaction((nextClaim) => {
    const submittedClaim = db
      .prepare(
        `
          SELECT 1
          FROM shipping_claims
          WHERE wallet_address = @walletAddress
            AND claim_status = 'submitted'
          LIMIT 1
        `
      )
      .get({ walletAddress });

    if (submittedClaim) {
      throw new HttpError(409, 'shipping_claim_already_submitted');
    }

    // A wallet can revise its draft, but only one draft remains before submission.
    db.prepare(
      `
        DELETE FROM shipping_claims
        WHERE wallet_address = @walletAddress
          AND claim_status = 'draft'
      `
    ).run({ walletAddress });

    db.prepare(`
      INSERT INTO shipping_claims (
        id,
        created_at,
        wallet_address,
        user_sub,
        user_email,
        sbt_balance,
        sbt_badge_count,
        minimum_sbt_balance,
        sbt_contract,
        eligibility_source,
        first_name,
        last_name,
        email,
        gmail,
        size,
        phone,
        country,
        address_line_1,
        address_line_2,
        city,
        region,
        postal_code,
        delivery_notes,
        claim_status,
        submitted_at,
        eligibility_json,
        shipping_json,
        user_json
      ) VALUES (
        @id,
        @createdAt,
        @walletAddress,
        @userSub,
        @userEmail,
        @sbtBalance,
        @sbtBadgeCount,
        @minimumSbtBalance,
        @sbtContract,
        @eligibilitySource,
        @firstName,
        @lastName,
        @email,
        @gmail,
        @size,
        @phone,
        @country,
        @addressLine1,
        @addressLine2,
        @city,
        @region,
        @postalCode,
        @deliveryNotes,
        @status,
        @submittedAt,
        @eligibilityJson,
        @shippingJson,
        @userJson
      )
    `).run(toClaimRow(nextClaim));
  });

  try {
    runWithSqliteBusyRetry(() => writeClaim(claim));
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(500, 'claim_write_failed', String(error));
  }

  return claim;
}

export function readStoredShippingClaims(options = {}) {
  const db = getShippingClaimsDb(options.dbPath);
  const rows = db
    .prepare(
      'SELECT eligibility_json, shipping_json, user_json, id, created_at, claim_status, submitted_at FROM shipping_claims ORDER BY created_at ASC, id ASC'
    )
    .all();

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    eligibility: JSON.parse(row.eligibility_json),
    shipping: JSON.parse(row.shipping_json),
    status: row.claim_status,
    submittedAt: row.submitted_at,
    user: JSON.parse(row.user_json)
  }));
}

export function readLatestShippingClaim(session, options = {}) {
  const walletAddress = readSessionWalletAddress(session);
  const db = getShippingClaimsDb(options.dbPath);
  const row = db
    .prepare(
      `
        SELECT created_at, shipping_json, claim_status, submitted_at
        FROM shipping_claims
        WHERE wallet_address = @walletAddress
        ORDER BY
          CASE claim_status WHEN 'submitted' THEN 0 ELSE 1 END,
          created_at DESC,
          id DESC
        LIMIT 1
      `
    )
    .get({ walletAddress });

  return {
    claim: row
      ? {
          savedAt: row.created_at,
          shipping: JSON.parse(row.shipping_json),
          status: normalizeClaimStatus(row.claim_status),
          submittedAt: row.submitted_at || null
        }
      : null,
    hasSubmitted: hasSubmittedClaim(session, options)
  };
}

export function hasSubmittedClaim(session, options = {}) {
  const walletAddress = readSessionWalletAddress(session);
  const db = getShippingClaimsDb(options.dbPath);
  const row = db
    .prepare(
      `
        SELECT 1
        FROM shipping_claims
        WHERE wallet_address = @walletAddress
          AND claim_status = 'submitted'
        LIMIT 1
      `
    )
    .get({ walletAddress });

  return !!row;
}

function getShippingClaimsDb(configuredPath) {
  const dbPath = getClaimDatabasePath(configuredPath);
  const cached = dbByPath.get(dbPath);

  if (cached) {
    return cached;
  }

  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath, {
    timeout: 5000
  });

  runWithSqliteBusyRetry(() => {
    db.pragma('busy_timeout = 5000');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE IF NOT EXISTS shipping_claims (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
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

      CREATE INDEX IF NOT EXISTS idx_shipping_claims_wallet_created_at
        ON shipping_claims (wallet_address, created_at);

      CREATE INDEX IF NOT EXISTS idx_shipping_claims_created_at
        ON shipping_claims (created_at);
    `);

    ensureColumn(db, 'shipping_claims', 'size', 'size TEXT');
    ensureColumn(
      db,
      'shipping_claims',
      'claim_status',
      "claim_status TEXT NOT NULL DEFAULT 'draft'"
    );
    ensureColumn(db, 'shipping_claims', 'submitted_at', 'submitted_at TEXT');
  });

  dbByPath.set(dbPath, db);

  return db;
}

function toClaimRow(claim) {
  return {
    addressLine1: claim.shipping.addressLine1,
    addressLine2: claim.shipping.addressLine2,
    city: claim.shipping.city,
    country: claim.shipping.country,
    createdAt: claim.createdAt,
    deliveryNotes: claim.shipping.deliveryNotes,
    eligibilityJson: JSON.stringify(claim.eligibility),
    eligibilitySource: claim.eligibility.source,
    email: claim.shipping.email,
    firstName: claim.shipping.firstName,
    gmail: null,
    id: claim.id,
    lastName: claim.shipping.lastName,
    minimumSbtBalance: claim.eligibility.minimumSbtBalance,
    phone: claim.shipping.phone,
    postalCode: claim.shipping.postalCode,
    region: claim.shipping.region,
    sbtBadgeCount: claim.eligibility.sbtBadgeCount,
    sbtBalance: claim.eligibility.sbtBalance,
    sbtContract: claim.eligibility.sbtContract,
    size: claim.shipping.size,
    shippingJson: JSON.stringify(claim.shipping),
    status: claim.status,
    submittedAt: claim.submittedAt,
    userEmail: claim.user.email,
    userJson: JSON.stringify(claim.user),
    userSub: claim.user.sub,
    walletAddress: claim.eligibility.walletAddress
  };
}

function runWithSqliteBusyRetry(operation) {
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

function isSqliteBusy(error) {
  return error?.code === 'SQLITE_BUSY' || error?.code === 'SQLITE_LOCKED';
}

function sleepSync(durationMs) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, durationMs);
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;

    if (size > MAX_REQUEST_BODY_BYTES) {
      throw new HttpError(413, 'request_too_large');
    }

    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    throw new HttpError(400, 'request_body_required');
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

function normalizeShippingPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpError(400, 'invalid_shipping_payload');
  }

  return {
    addressLine1: readRequiredText(payload.addressLine1, 'address_line_1_required', 160),
    addressLine2: readOptionalText(payload.addressLine2, 160),
    city: readRequiredText(payload.city, 'city_required', 80),
    country: readCountry(payload.country),
    deliveryNotes: readOptionalText(payload.deliveryNotes, 600),
    email: readEmail(payload.email, 'email_invalid'),
    firstName: readRequiredText(payload.firstName, 'first_name_required', 80),
    lastName: readRequiredText(payload.lastName, 'last_name_required', 80),
    phone: readPhone(payload.phone),
    postalCode: readRequiredText(payload.postalCode, 'postal_code_required', 32),
    region: readRequiredText(payload.region, 'region_required', 80),
    size: readSize(payload.size)
  };
}

function ensureColumn(db, tableName, columnName, columnDefinition) {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((column) => column.name);

  if (columns.includes(columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
}

function readShippingIntent(value) {
  return value === 'submit' ? 'submit' : 'save';
}

function normalizeClaimStatus(value) {
  return value === 'submitted' ? 'submitted' : 'draft';
}

function readSessionWalletAddress(session) {
  const walletAddress = normalizeWalletAddress(session?.user?.safeWalletAddress);

  if (!walletAddress) {
    throw new HttpError(409, 'safe_wallet_not_ready');
  }

  return walletAddress;
}

function normalizeWalletAddress(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const walletAddress = value.trim().toLowerCase();

  return walletPattern.test(walletAddress) ? walletAddress : null;
}

function sanitizeUser(user) {
  return {
    chainId: readNullableString(user.chainId),
    email: readNullableString(user.email),
    emailVerified: user.emailVerified === true,
    legacyWalletAddress: readNullableString(user.legacyWalletAddress),
    name: readNullableString(user.name),
    safeWalletAddress: readNullableString(user.safeWalletAddress),
    sub: readNullableString(user.sub),
    twitterUsername: readNullableString(user.twitterUsername)
  };
}

function readRequiredText(value, code, maxLength) {
  const text = readOptionalText(value, maxLength);

  if (!text) {
    throw new HttpError(400, code);
  }

  return text;
}

function readOptionalText(value, maxLength) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, 'invalid_field_type');
  }

  const text = value.trim().replace(/\s+/g, ' ');

  if (text.length > maxLength) {
    throw new HttpError(400, 'field_too_long');
  }

  return text;
}

function readEmail(value, code) {
  const email = readRequiredText(value, code, 160).toLowerCase();

  if (!emailPattern.test(email)) {
    throw new HttpError(400, code);
  }

  return email;
}

function readPhone(value) {
  const phone = readRequiredText(value, 'phone_required', 32);

  if (!phonePattern.test(phone)) {
    throw new HttpError(400, 'phone_invalid');
  }

  return phone;
}

function readCountry(value) {
  const country = readRequiredText(value, 'country_required', 2).toUpperCase();

  if (!countryPattern.test(country)) {
    throw new HttpError(400, 'country_invalid');
  }

  return country;
}

function readSize(value) {
  const size = readRequiredText(value, 'size_required', 2).toUpperCase();

  if (!sizePattern.test(size)) {
    throw new HttpError(400, 'size_invalid');
  }

  return size;
}

function readNullableString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
