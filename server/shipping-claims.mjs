import { randomUUID } from 'node:crypto';
import {
  readMerchEligibility,
  readMerchProductId
} from './eligibility.mjs';
import { HttpError, sendJson } from './http.mjs';
import {
  getMerchDatabase,
  runWithSqliteBusyRetry
} from './merch-database.mjs';
import { requireMerchProductInventory } from './merch-inventory.mjs';
import {
  MERCH_PRODUCT_ENTITLEMENT_SOURCES,
  grantMerchProductEntitlement,
  readMerchProductEntitlements
} from './merch-product-entitlements.mjs';
import {
  normalizeShippingPayload,
  readJsonBody
} from './shipping-details.mjs';

const walletPattern = /^0x[a-fA-F0-9]{40}$/;

export function handleStoredMerchShippingClaim(res, session, options = {}) {
  if (!session) {
    throw new HttpError(401, 'unauthenticated');
  }

  const productId = readMerchProductId(options.productId);
  sendJson(
    res,
    200,
    readLatestShippingClaim(session, {
      ...options.readOptions,
      productId
    })
  );
}

export async function handleMerchShippingClaim(req, res, session, options = {}) {
  if (!session) {
    throw new HttpError(401, 'unauthenticated');
  }

  const readEligibility = options.readEligibility || readMerchEligibility;
  const writeShippingClaim = options.saveShippingClaim || saveShippingClaim;
  const payload = await readJsonBody(req);
  const productId = readMerchProductId(payload.productId);
  const eligibility = await readEligibility(session, { productId });

  if (eligibility.status !== 'eligible') {
    throw new HttpError(403, 'wallet_not_eligible');
  }

  const intent = readShippingIntent(payload.intent);
  const shipping = normalizeShippingPayload(
    payload.shipping || payload,
    productId
  );
  const claim = writeShippingClaim(
    {
      eligibility,
      intent,
      productId,
      shipping,
      user: sanitizeUser(session.user)
    },
    options.saveOptions
  );

  sendJson(res, 201, {
    hasSubmitted: hasSubmittedClaim(session, {
      ...options.saveOptions,
      productId
    }),
    claimId: claim.id,
    productId,
    savedAt: claim.createdAt,
    status: claim.status,
    submittedAt: claim.submittedAt
  });
}

export function saveShippingClaim(claimInput, options = {}) {
  const db = getMerchDatabase(options.dbPath);
  const createdAt = new Date().toISOString();
  const productId = readMerchProductId(claimInput.productId);
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
    productId,
    status,
    shipping: claimInput.shipping,
    submittedAt: status === 'submitted' ? createdAt : null,
    user: claimInput.user
  };
  const writeClaim = db.transaction((nextClaim) => {
    const existingEntitlement = db
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

    if (existingEntitlement) {
      throw new HttpError(409, 'shipping_claim_already_submitted');
    }

    if (nextClaim.status === 'submitted') {
      requireMerchProductInventory(db, productId);
    }

    // A wallet can revise its draft, but only one draft remains before submission.
    db.prepare(
      `
        DELETE FROM shipping_claims
        WHERE wallet_address = @walletAddress
          AND product_id = @productId
          AND claim_status = 'draft'
      `
    ).run({ productId, walletAddress });

    const claimRow = toClaimRow(nextClaim);

    db.prepare(`
      INSERT INTO shipping_claims (
        id,
        created_at,
        product_id,
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
        color,
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
        @productId,
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
        @color,
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
    `).run(claimRow);

    if (nextClaim.status === 'submitted') {
      grantMerchProductEntitlement(db, {
        eligibilityJson: claimRow.eligibilityJson,
        grantedAt: nextClaim.submittedAt,
        productId,
        source: MERCH_PRODUCT_ENTITLEMENT_SOURCES.submittedClaim,
        sourceClaimId: nextClaim.id,
        walletAddress
      });
    }
  });

  try {
    runWithSqliteBusyRetry(() => writeClaim.immediate(claim));
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(500, 'claim_write_failed', String(error));
  }

  return claim;
}

export function readStoredShippingClaims(options = {}) {
  const db = getMerchDatabase(options.dbPath);
  const rows = db
    .prepare(
      'SELECT eligibility_json, shipping_json, user_json, id, created_at, product_id, claim_status, submitted_at FROM shipping_claims ORDER BY created_at ASC, id ASC'
    )
    .all();

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    eligibility: JSON.parse(row.eligibility_json),
    productId: readMerchProductId(row.product_id),
    shipping: JSON.parse(row.shipping_json),
    status: row.claim_status,
    submittedAt: row.submitted_at,
    user: JSON.parse(row.user_json)
  }));
}

export function readLatestShippingClaim(session, options = {}) {
  const walletAddress = readSessionWalletAddress(session);
  const productId = readMerchProductId(options.productId);
  const db = getMerchDatabase(options.dbPath);
  const entitlement = readClaimEntitlements(session, {
    ...options,
    productId
  })[0];
  const hasSubmitted = !!entitlement;
  const row = entitlement
    ? db
        .prepare(
          `
            SELECT
              created_at,
              product_id,
              shipping_json,
              claim_status,
              submitted_at
            FROM shipping_claims
            WHERE id = @sourceClaimId
              AND wallet_address = @walletAddress
              AND product_id = @productId
            LIMIT 1
          `
        )
        .get({
          productId,
          sourceClaimId: entitlement.sourceClaimId,
          walletAddress
        })
    : db
        .prepare(
          `
            SELECT
              created_at,
              product_id,
              shipping_json,
              claim_status,
              submitted_at
            FROM shipping_claims
            WHERE wallet_address = @walletAddress
              AND product_id = @productId
            ORDER BY created_at DESC, id DESC
            LIMIT 1
          `
        )
        .get({ productId, walletAddress });

  if (entitlement && !row) {
    throw new HttpError(500, 'merch_claim_entitlement_source_missing');
  }

  return {
    claim: row
      ? {
          savedAt: row.created_at,
          productId: readMerchProductId(row.product_id),
          shipping: JSON.parse(row.shipping_json),
          status: hasSubmitted
            ? 'submitted'
            : normalizeClaimStatus(row.claim_status),
          submittedAt: row.submitted_at || (hasSubmitted ? row.created_at : null)
        }
      : null,
    hasSubmitted
  };
}

export function readClaimEntitlements(session, options = {}) {
  const walletAddress = readSessionWalletAddress(session);
  const db = getMerchDatabase(options.dbPath);

  return readMerchProductEntitlements(db, {
    productId: options.productId,
    walletAddress
  });
}

export function hasSubmittedClaim(session, options = {}) {
  const walletAddress = readSessionWalletAddress(session);
  const productId = readMerchProductId(options.productId);
  const db = getMerchDatabase(options.dbPath);
  const row = db
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

  return !!row;
}

function toClaimRow(claim) {
  return {
    addressLine1: claim.shipping.addressLine1,
    addressLine2: claim.shipping.addressLine2,
    city: claim.shipping.city,
    color: claim.shipping.color,
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
    productId: claim.productId,
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
    isDemo: user.isDemo === true,
    legacyWalletAddress: readNullableString(user.legacyWalletAddress),
    name: readNullableString(user.name),
    safeWalletAddress: readNullableString(user.safeWalletAddress),
    sub: readNullableString(user.sub),
    twitterUsername: readNullableString(user.twitterUsername)
  };
}

function readNullableString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
