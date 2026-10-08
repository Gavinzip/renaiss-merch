import { readMerchEligibility } from '../eligibility.mjs';
import { HttpError } from '../http.mjs';

// The profile shows current holdings, not a reusable product access proof.
export async function readHubMemberSbt(session, options = {}) {
  const readEligibility = options.readEligibility || readMerchEligibility;
  const result = await readEligibility(session, {
    productId: 'shirt',
    forceRefresh: options.forceRefresh === true
  });

  if (!Number.isSafeInteger(result.sbtBadgeCount) || result.sbtBadgeCount < 0 ||
      typeof result.walletAddress !== 'string' ||
      !Number.isFinite(Date.parse(result.verifiedAt))) {
    throw new HttpError(502, 'member_sbt_invalid_result');
  }

  return {
    walletAddress: result.walletAddress,
    sbtBadgeCount: result.sbtBadgeCount,
    checkedAt: result.verifiedAt
  };
}
