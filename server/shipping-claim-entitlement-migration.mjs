import {
  MERCH_PRODUCT_ENTITLEMENT_SOURCES,
  grantMerchProductEntitlement
} from './merch-product-entitlements.mjs';

const SHIPPING_CLAIM_ENTITLEMENT_MIGRATION_ID =
  '2026-08-05-backfill-product-entitlements-from-claims-v1';

export function runShippingClaimEntitlementBackfillMigration(
  database,
  options = {}
) {
  const appliedAt = options.appliedAt || new Date().toISOString();
  const applyMigration = database.transaction(() => {
    const existingMigration = database
      .prepare(
        `
          SELECT 1
          FROM merch_data_migrations
          WHERE id = ?
          LIMIT 1
        `
      )
      .get(SHIPPING_CLAIM_ENTITLEMENT_MIGRATION_ID);

    if (existingMigration) {
      return {
        status: 'already_applied',
        legacyFinalClaims: 0,
        submittedClaims: 0,
        entitlementsUpserted: 0
      };
    }

    const claims = database
      .prepare(
        `
          SELECT
            id,
            created_at,
            product_id,
            wallet_address,
            claim_status,
            submitted_at,
            eligibility_json
          FROM shipping_claims
          WHERE claim_status = 'submitted'
             OR (
               product_id = 'shirt'
               AND claim_status = 'draft'
               AND submitted_at IS NULL
               AND (size IS NULL OR TRIM(size) = '')
             )
          ORDER BY
            CASE claim_status WHEN 'submitted' THEN 1 ELSE 0 END ASC,
            created_at ASC,
            id ASC
        `
      )
      .all();
    let legacyFinalClaims = 0;
    let submittedClaims = 0;
    let entitlementsUpserted = 0;

    for (const claim of claims) {
      const isSubmitted = claim.claim_status === 'submitted';

      if (isSubmitted) {
        submittedClaims += 1;
      } else {
        legacyFinalClaims += 1;
      }

      const result = grantMerchProductEntitlement(database, {
        eligibilityJson: claim.eligibility_json,
        grantedAt: claim.submitted_at || claim.created_at,
        productId: claim.product_id,
        source: isSubmitted
          ? MERCH_PRODUCT_ENTITLEMENT_SOURCES.submittedClaim
          : MERCH_PRODUCT_ENTITLEMENT_SOURCES.legacyFinalClaim,
        sourceClaimId: claim.id,
        walletAddress: claim.wallet_address
      });

      entitlementsUpserted += result.changes;
    }

    const metadata = {
      entitlementsUpserted,
      legacyFinalClaims,
      submittedClaims
    };

    database
      .prepare(
        `
          INSERT INTO merch_data_migrations (
            id,
            applied_at,
            metadata_json
          ) VALUES (?, ?, ?)
        `
      )
      .run(
        SHIPPING_CLAIM_ENTITLEMENT_MIGRATION_ID,
        appliedAt,
        JSON.stringify(metadata)
      );

    return {
      status: 'applied',
      ...metadata
    };
  });

  return applyMigration();
}
