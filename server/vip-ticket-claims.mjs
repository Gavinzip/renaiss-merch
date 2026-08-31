import { randomUUID } from 'node:crypto';
import { normalizeClaimEmail } from './claim-email.mjs';
import {
  readMerchEligibility,
  readMerchProductId
} from './eligibility.mjs';
import { HttpError, sendJson } from './http.mjs';
import {
  getMerchDatabase,
  runWithSqliteBusyRetry
} from './merch-database.mjs';
import {
  MERCH_PRODUCT_ENTITLEMENT_SOURCES,
  grantMerchProductEntitlement
} from './merch-product-entitlements.mjs';
import { readJsonBody } from './shipping-details.mjs';

const walletPattern = /^0x[a-fA-F0-9]{40}$/;

export function handleStoredVipTicketClaim(res, session, options = {}) {
  sendJson(res, 200, readLatestVipTicketClaim(session, options));
}

export async function handleVipTicketClaim(req, res, session, options = {}) {
  if (!session) {
    throw new HttpError(401, 'unauthenticated');
  }

  const payload = await readJsonBody(req);
  const productId = readVipTicketProductId(payload.productId);
  const readEligibility = options.readEligibility || readMerchEligibility;
  const eligibility = await readEligibility(session, { productId });

  if (eligibility.status !== 'eligible') {
    throw new HttpError(403, 'wallet_not_eligible');
  }

  const claim = saveVipTicketClaim(
    {
      eligibility,
      email: normalizeClaimEmail(payload.email),
      productId,
      user: sanitizeUser(session.user)
    },
    options.saveOptions
  );

  sendJson(res, 201, {
    claim: {
      email: claim.email,
      productId: claim.productId,
      savedAt: claim.createdAt,
      status: 'submitted',
      submittedAt: claim.submittedAt
    },
    hasSubmitted: true
  });
}

export function saveVipTicketClaim(claimInput, options = {}) {
  const database = getMerchDatabase(options.dbPath);
  const productId = readVipTicketProductId(claimInput.productId);
  const walletAddress = normalizeWalletAddress(
    claimInput.eligibility?.walletAddress
  );

  if (!walletAddress) {
    throw new HttpError(409, 'safe_wallet_not_ready');
  }

  const createdAt = new Date().toISOString();
  const claim = {
    createdAt,
    email: normalizeClaimEmail(claimInput.email),
    eligibility: {
      ...claimInput.eligibility,
      walletAddress
    },
    id: randomUUID(),
    productId,
    submittedAt: createdAt,
    user: claimInput.user
  };
  const writeClaim = database.transaction((nextClaim) => {
    const existing = database
      .prepare(
        `
          SELECT 1
          FROM merch_product_entitlements
          WHERE wallet_address = @walletAddress
            AND product_id = @productId
          LIMIT 1
        `
      )
      .get({ productId, walletAddress });

    if (existing) {
      throw new HttpError(409, 'vip_ticket_claim_already_submitted');
    }

    const eligibilityJson = JSON.stringify(nextClaim.eligibility);
    const userJson = JSON.stringify(nextClaim.user);

    database
      .prepare(
        `
          INSERT INTO vip_ticket_claims (
            id,
            created_at,
            submitted_at,
            product_id,
            wallet_address,
            user_sub,
            user_email,
            claim_email,
            eligibility_json,
            user_json
          ) VALUES (
            @id,
            @createdAt,
            @submittedAt,
            @productId,
            @walletAddress,
            @userSub,
            @userEmail,
            @email,
            @eligibilityJson,
            @userJson
          )
        `
      )
      .run({
        ...nextClaim,
        eligibilityJson,
        userEmail: nextClaim.user.email,
        userJson,
        userSub: nextClaim.user.sub,
        walletAddress
      });

    grantMerchProductEntitlement(database, {
      eligibilityJson,
      grantedAt: nextClaim.submittedAt,
      productId,
      source: MERCH_PRODUCT_ENTITLEMENT_SOURCES.submittedClaim,
      sourceClaimId: nextClaim.id,
      walletAddress
    });
  });

  try {
    runWithSqliteBusyRetry(() => writeClaim.immediate(claim));
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(500, 'vip_ticket_claim_write_failed', String(error));
  }

  return claim;
}

export function readLatestVipTicketClaim(session, options = {}) {
  if (!session) {
    throw new HttpError(401, 'unauthenticated');
  }

  const productId = readVipTicketProductId(options.productId);
  const walletAddress = normalizeWalletAddress(
    session.user?.safeWalletAddress
  );

  if (!walletAddress) {
    throw new HttpError(409, 'safe_wallet_not_ready');
  }

  const row = getMerchDatabase(options.dbPath)
    .prepare(
      `
        SELECT claim_email, created_at, submitted_at
        FROM vip_ticket_claims
        WHERE wallet_address = @walletAddress
          AND product_id = @productId
        LIMIT 1
      `
    )
    .get({ productId, walletAddress });

  return {
    claim: row
      ? {
          email: row.claim_email,
          productId,
          savedAt: row.created_at,
          status: 'submitted',
          submittedAt: row.submitted_at
        }
      : null,
    hasSubmitted: !!row
  };
}

export function readStoredVipTicketClaims(options = {}) {
  return getMerchDatabase(options.dbPath)
    .prepare(
      `
        SELECT
          id,
          created_at,
          submitted_at,
          product_id,
          claim_email,
          eligibility_json,
          user_json
        FROM vip_ticket_claims
        ORDER BY submitted_at ASC, id ASC
      `
    )
    .all()
    .map((row) => ({
      createdAt: row.created_at,
      eligibility: JSON.parse(row.eligibility_json),
      id: row.id,
      productId: readVipTicketProductId(row.product_id),
      shipping: { email: row.claim_email },
      status: 'submitted',
      submittedAt: row.submitted_at,
      user: JSON.parse(row.user_json)
    }));
}

function readVipTicketProductId(value) {
  const productId = readMerchProductId(value);

  if (productId !== 'ticket') {
    throw new HttpError(400, 'vip_ticket_product_invalid');
  }

  return productId;
}

function normalizeWalletAddress(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const walletAddress = value.trim().toLowerCase();
  return walletPattern.test(walletAddress) ? walletAddress : null;
}

function sanitizeUser(user = {}) {
  return {
    email: readNullableString(user.email),
    emailVerified: user.emailVerified === true,
    name: readNullableString(user.name),
    safeWalletAddress: readNullableString(user.safeWalletAddress),
    sub: readNullableString(user.sub),
    twitterUsername: readNullableString(user.twitterUsername)
  };
}

function readNullableString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
