import {
  applyClaimEntitlementAccess,
  applyCurrentMerchEligibilityRule,
  readConfiguredSbtContract,
  readMerchEligibility,
  readMerchProductId,
} from "../eligibility.mjs";
import { selectReusableEligibilityProof } from "../merch-eligibility-proof.mjs";
import { hasCurrentSbtVerification } from "../sbt-verification.mjs";
import { getPrivateMerchMediaRelease } from "../merch-media-assets.mjs";
import { getPool, sqlTables } from "./database.mjs";
import { claimStore, identity } from "./claims.mjs";

export function accessStore(
  database = getPool(),
  readEligibility = readMerchEligibility,
  schema = "public",
) {
  const tables = sqlTables(schema);
  const claims = claimStore(database, schema);
  return {
    async check(session, productId, { forceRefresh = false } = {}) {
      productId = readMerchProductId(productId);
      const { wallet, sub } = identity(session);
      const [entitlement] = await claims.entitlements(session, productId);
      if (entitlement)
        return applyClaimEntitlementAccess(
          productId,
          JSON.parse(entitlement.eligibility_json),
        );
      if (!forceRefresh) {
        const { rows } = await database.query(
          `SELECT product_id,checked_at,eligibility_json FROM ${tables.merch_access_checks} WHERE wallet_address=$1 AND status='eligible' ORDER BY checked_at DESC`,
          [wallet],
        );
        const proof = selectReusableEligibilityProof(rows, {
          productId,
          walletAddress: wallet,
          sbtContract: readConfiguredSbtContract(),
        });
        if (proof) return proof;
      }
      const result = await readEligibility(session, {
        productId,
        forceRefresh,
      });
      await database.query(
        `INSERT INTO ${tables.merch_access_checks}(wallet_address,product_id,user_sub,status,checked_at,eligibility_json) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(wallet_address,product_id) DO UPDATE SET user_sub=excluded.user_sub,status=excluded.status,checked_at=excluded.checked_at,eligibility_json=excluded.eligibility_json`,
        [
          wallet,
          productId,
          sub,
          result.status,
          new Date().toISOString(),
          JSON.stringify(result),
        ],
      );
      return result;
    },
    async read(session) {
      const { wallet } = identity(session);
      const [{ rows }, entitlements] = await Promise.all([
        database.query(
          `SELECT a.*,(SELECT claim_status FROM ${tables.shipping_claims} c
        WHERE c.wallet_address=a.wallet_address AND c.product_id=a.product_id ORDER BY CASE claim_status WHEN 'submitted' THEN 0 ELSE 1 END,created_at DESC,id DESC LIMIT 1) claim_status
        FROM ${tables.merch_access_checks} a WHERE wallet_address=$1 ORDER BY product_id`,
          [wallet],
        ),
        claims.entitlements(session),
      ]);
      const products = new Map();
      for (const row of rows) {
        const eligibility = JSON.parse(row.eligibility_json);
        if (hasCurrentSbtVerification(eligibility))
          products.set(row.product_id, {
            ...applyCurrentMerchEligibilityRule(row.product_id, eligibility),
            checkedAt: row.checked_at,
            claimStatus: row.claim_status || null,
          });
      }
      for (const row of entitlements)
        products.set(row.product_id, {
          ...applyClaimEntitlementAccess(
            row.product_id,
            JSON.parse(row.eligibility_json),
          ),
          checkedAt: row.granted_at,
          claimStatus: "submitted",
        });
      return {
        privateMediaRelease: getPrivateMerchMediaRelease(),
        products: [...products.values()].sort((a, b) =>
          a.productId.localeCompare(b.productId),
        ),
      };
    },
  };
}
