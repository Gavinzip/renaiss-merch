import { readMerchProductId } from './eligibility.mjs';
import { HttpError } from './http.mjs';

export const MERCH_PRODUCT_ENTITLEMENT_SOURCES = Object.freeze({
  legacyFinalClaim: 'legacy_final_claim',
  submittedClaim: 'submitted_claim'
});

export function grantMerchProductEntitlement(database, entitlement) {
  return database
    .prepare(
      `
        INSERT INTO merch_product_entitlements (
          wallet_address,
          product_id,
          source_claim_id,
          source,
          granted_at,
          eligibility_json
        ) VALUES (
          @walletAddress,
          @productId,
          @sourceClaimId,
          @source,
          @grantedAt,
          @eligibilityJson
        )
        ON CONFLICT(wallet_address, product_id) DO UPDATE SET
          source_claim_id = excluded.source_claim_id,
          source = excluded.source,
          granted_at = excluded.granted_at,
          eligibility_json = excluded.eligibility_json
      `
    )
    .run(entitlement);
}

export function readMerchProductEntitlements(database, options) {
  const requestedProductId = options.productId
    ? readMerchProductId(options.productId)
    : null;
  const rows = database
    .prepare(
      `
        SELECT
          product_id,
          source_claim_id,
          source,
          granted_at,
          eligibility_json
        FROM merch_product_entitlements
        WHERE wallet_address = @walletAddress
          AND (
            @requestedProductId IS NULL
            OR product_id = @requestedProductId
          )
        ORDER BY product_id ASC
      `
    )
    .all({
      requestedProductId,
      walletAddress: options.walletAddress
    });

  return rows.map((row) => ({
    claimStatus: readClaimEntitlementStatus(row.source),
    eligibility: JSON.parse(row.eligibility_json),
    grantedAt: row.granted_at,
    productId: readMerchProductId(row.product_id),
    source: row.source,
    sourceClaimId: row.source_claim_id
  }));
}

function readClaimEntitlementStatus(source) {
  if (
    source === MERCH_PRODUCT_ENTITLEMENT_SOURCES.submittedClaim ||
    source === MERCH_PRODUCT_ENTITLEMENT_SOURCES.legacyFinalClaim
  ) {
    return 'submitted';
  }

  throw new HttpError(500, 'merch_claim_entitlement_invalid');
}
