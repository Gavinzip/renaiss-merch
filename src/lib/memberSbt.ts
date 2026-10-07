import type { MerchEligibilityResult } from './merchEligibility';

// Count held badges, not token units. An account change must invalidate old data.
export function readMemberBadgeCount(result: MerchEligibilityResult, wallet: string): number {
  const count = result.sbtBadgeCount;
  if (result.walletAddress.toLowerCase() !== wallet.toLowerCase() ||
    typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
    throw new Error('SBT badge count is missing, invalid, or belongs to another wallet.');
  }
  return count;
}
