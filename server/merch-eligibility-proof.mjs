import {
  applyCurrentMerchEligibilityRule,
  readConfiguredSbtContract,
  readMerchMinimumSbtBalance,
  readMerchProductId
} from './eligibility.mjs';
import { HttpError } from './http.mjs';
import { getMerchDatabase } from './merch-database.mjs';
import { hasCurrentSbtVerification } from './sbt-verification.mjs';

const DEFAULT_PROOF_TTL_SECONDS = 24 * 60 * 60;
const walletPattern = /^0x[a-fA-F0-9]{40}$/;

export function readReusableEligibilityProof(
  session,
  options = {}
) {
  const walletAddress = readSessionWalletAddress(session);
  const productId = readMerchProductId(options.productId);
  const sbtContract = readConfiguredSbtContract();
  const rows = getMerchDatabase(options.dbPath)
    .prepare(
      `
        SELECT
          product_id,
          checked_at,
          eligibility_json
        FROM merch_access_checks
        WHERE wallet_address = ?
          AND status = 'eligible'
        ORDER BY checked_at DESC
      `
    )
    .all(walletAddress);

  return selectReusableEligibilityProof(rows, {
    now: options.now,
    productId,
    proofTtlSeconds: options.proofTtlSeconds,
    sbtContract,
    walletAddress
  });
}

export function selectReusableEligibilityProof(rows, options = {}) {
  const walletAddress = normalizeWalletAddress(options.walletAddress);
  const productId = readMerchProductId(options.productId);
  const targetMinimumSbtBalance = readMerchMinimumSbtBalance(productId);
  const sbtContract = normalizeWalletAddress(options.sbtContract);
  const nowMs = readNowMs(options.now);
  const proofTtlMs = readProofTtlMs(options.proofTtlSeconds);

  if (!walletAddress) {
    throw new HttpError(500, 'merch_access_proof_wallet_invalid');
  }

  if (!sbtContract) {
    throw new HttpError(500, 'sbt_contract_invalid');
  }

  for (const row of rows) {
    const sourceProductId = readMerchProductId(row.product_id);
    const sourceMinimumSbtBalance =
      readMerchMinimumSbtBalance(sourceProductId);

    if (sourceMinimumSbtBalance < targetMinimumSbtBalance) {
      continue;
    }

    const storedEligibility = readStoredEligibility(row.eligibility_json);
    // Explorer-only snapshots predate the dual-source policy and must be
    // rechecked rather than carrying the old undercount into the new reader.
    if (!hasCurrentSbtVerification(storedEligibility)) continue;
    const proofCheckedAt = readProofCheckedAt(storedEligibility);

    if (
      normalizeWalletAddress(storedEligibility.walletAddress) !==
        walletAddress ||
      normalizeWalletAddress(storedEligibility.sbtContract) !== sbtContract ||
      !isProofFresh(proofCheckedAt, nowMs, proofTtlMs)
    ) {
      continue;
    }

    const currentSourceEligibility = applyCurrentMerchEligibilityRule(
      sourceProductId,
      storedEligibility
    );

    if (currentSourceEligibility.status !== 'eligible') {
      continue;
    }

    return applyCurrentMerchEligibilityRule(productId, {
      ...currentSourceEligibility,
      productId,
      proofCheckedAt,
      proofProductId: sourceProductId,
      source: 'stored_access_proof'
    });
  }

  return null;
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

function readStoredEligibility(value) {
  try {
    const eligibility = JSON.parse(value);

    if (!eligibility || typeof eligibility !== 'object') {
      throw new Error('eligibility_not_an_object');
    }

    return eligibility;
  } catch (error) {
    throw new HttpError(
      500,
      'merch_access_eligibility_invalid',
      String(error)
    );
  }
}

function readProofCheckedAt(eligibility) {
  const proofCheckedAt =
    eligibility.source === 'stored_higher_tier_access' ||
    eligibility.source === 'stored_access_proof'
      ? eligibility.proofCheckedAt
      : eligibility.verifiedAt;
  const proofTimestamp = Date.parse(proofCheckedAt);

  if (!Number.isFinite(proofTimestamp)) {
    throw new HttpError(500, 'merch_access_checked_at_invalid');
  }

  return new Date(proofTimestamp).toISOString();
}

function isProofFresh(proofCheckedAt, nowMs, proofTtlMs) {
  const proofTimestamp = Date.parse(proofCheckedAt);
  const proofAgeMs = nowMs - proofTimestamp;
  return proofAgeMs >= 0 && proofAgeMs <= proofTtlMs;
}

function readNowMs(value) {
  if (value === undefined) {
    return Date.now();
  }

  const nowMs = value instanceof Date ? value.getTime() : Number(value);

  if (!Number.isFinite(nowMs)) {
    throw new HttpError(500, 'merch_access_proof_clock_invalid');
  }

  return nowMs;
}

function readProofTtlMs(value) {
  if (value === undefined) {
    return DEFAULT_PROOF_TTL_SECONDS * 1000;
  }

  const proofTtlSeconds = Number(value);

  if (!Number.isSafeInteger(proofTtlSeconds) || proofTtlSeconds <= 0) {
    throw new HttpError(500, 'merch_access_proof_ttl_invalid');
  }

  return proofTtlSeconds * 1000;
}

function normalizeWalletAddress(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const walletAddress = value.trim().toLowerCase();
  return walletPattern.test(walletAddress) ? walletAddress : '';
}
