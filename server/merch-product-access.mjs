import {
  applyClaimEntitlementAccess,
  readMerchEligibility,
  readMerchProductId
} from './eligibility.mjs';
import { HttpError } from './http.mjs';
import { readClaimEntitlements } from './shipping-claims.mjs';

export async function readMerchProductAccess(session, options = {}) {
  if (!session) {
    throw new HttpError(401, 'unauthenticated');
  }

  const productId = readMerchProductId(options.productId);
  const entitlement = readClaimEntitlements(session, {
    dbPath: options.dbPath,
    productId
  })[0];

  if (entitlement) {
    return applyClaimEntitlementAccess(
      productId,
      entitlement.eligibility
    );
  }

  const readEligibility = options.readEligibility || readMerchEligibility;
  return readEligibility(session, { productId });
}

export function readPermanentMerchAccessState(session, options = {}) {
  return readClaimEntitlements(session, options).map(
    (entitlement) => ({
      ...applyClaimEntitlementAccess(
        entitlement.productId,
        entitlement.eligibility
      ),
      checkedAt: entitlement.grantedAt,
      claimStatus: entitlement.claimStatus,
      productId: entitlement.productId
    })
  );
}
