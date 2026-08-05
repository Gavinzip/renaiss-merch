import {
  applyCurrentMerchEligibilityRule,
  readMerchProductId
} from './eligibility.mjs';
import { HttpError, sendJson } from './http.mjs';
import {
  getMerchDatabase,
  runWithSqliteBusyRetry
} from './merch-database.mjs';
import { readPermanentMerchAccessState } from './merch-product-access.mjs';

const walletPattern = /^0x[a-fA-F0-9]{40}$/;

export function handleMerchAccessState(res, session, options = {}) {
  sendJson(res, 200, {
    products: readMerchAccessState(session, options)
  });
}

export function readMerchAccessState(session, options = {}) {
  const walletAddress = readSessionWalletAddress(session);
  const database = getMerchDatabase(options.dbPath);
  const permanentAccessByProduct = new Map(
    readPermanentMerchAccessState(session, options).map((access) => [
      access.productId,
      access
    ])
  );
  const rows = database
    .prepare(
      `
        SELECT
          access.product_id,
          access.status,
          access.checked_at,
          access.eligibility_json,
          (
            SELECT claims.claim_status
            FROM shipping_claims AS claims
            WHERE claims.wallet_address = access.wallet_address
              AND claims.product_id = access.product_id
            ORDER BY
              CASE claims.claim_status WHEN 'submitted' THEN 0 ELSE 1 END,
              claims.created_at DESC,
              claims.id DESC
            LIMIT 1
          ) AS claim_status
        FROM merch_access_checks AS access
        WHERE access.wallet_address = ?
        ORDER BY access.product_id ASC
      `
    )
    .all(walletAddress);

  const accessStates = rows.map((row) => {
    const productId = readMerchProductId(row.product_id);
    const permanentAccess = permanentAccessByProduct.get(productId);

    if (permanentAccess) {
      permanentAccessByProduct.delete(productId);
      return permanentAccess;
    }

    const storedEligibility = JSON.parse(row.eligibility_json);
    const eligibility = applyCurrentMerchEligibilityRule(
      productId,
      storedEligibility
    );

    readAccessStatus(row.status);

    return {
      ...eligibility,
      checkedAt: row.checked_at,
      claimStatus: readClaimStatus(row.claim_status),
      productId,
      status: eligibility.status
    };
  });

  accessStates.push(...permanentAccessByProduct.values());
  return accessStates.sort((left, right) =>
    left.productId.localeCompare(right.productId)
  );
}

export function saveMerchAccessCheck(session, eligibility, options = {}) {
  const walletAddress = readSessionWalletAddress(session);
  const eligibilityWallet = normalizeWalletAddress(
    eligibility?.walletAddress
  );

  if (!eligibilityWallet || eligibilityWallet !== walletAddress) {
    throw new HttpError(409, 'merch_access_wallet_mismatch');
  }

  const productId = readMerchProductId(eligibility.productId);
  const status = readAccessStatus(eligibility.status);
  const checkedAt = new Date().toISOString();
  const database = getMerchDatabase(options.dbPath);

  runWithSqliteBusyRetry(() => {
    database
      .prepare(
        `
          INSERT INTO merch_access_checks (
            wallet_address,
            product_id,
            user_sub,
            status,
            checked_at,
            eligibility_json
          ) VALUES (
            @walletAddress,
            @productId,
            @userSub,
            @status,
            @checkedAt,
            @eligibilityJson
          )
          ON CONFLICT(wallet_address, product_id) DO UPDATE SET
            user_sub = excluded.user_sub,
            status = excluded.status,
            checked_at = excluded.checked_at,
            eligibility_json = excluded.eligibility_json
        `
      )
      .run({
        checkedAt,
        eligibilityJson: JSON.stringify(eligibility),
        productId,
        status,
        userSub: readOptionalString(session.user?.sub),
        walletAddress
      });
  });

  return {
    checkedAt,
    productId,
    status
  };
}

function readSessionWalletAddress(session) {
  if (!session) {
    throw new HttpError(401, 'unauthenticated');
  }

  const walletAddress = normalizeWalletAddress(
    session.user?.safeWalletAddress
  );

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

function readAccessStatus(value) {
  if (value !== 'eligible' && value !== 'unqualified') {
    throw new HttpError(500, 'merch_access_state_invalid');
  }

  return value;
}

function readClaimStatus(value) {
  if (value === 'submitted') {
    return 'submitted';
  }

  if (value === 'draft') {
    return 'draft';
  }

  return null;
}

function readOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
