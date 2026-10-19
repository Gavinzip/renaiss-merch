import { surfStoreRewards } from '../shared/surf-store-rewards.js';
import { HttpError } from './http.mjs';
import { readHubMemberSbt } from './hub/member-sbt.mjs';
import { getStorefrontFeatures } from './storefront-features.mjs';
import { assertSurfStoreOpen } from './surf-store-release.mjs';
import { identity } from './postgres/claims.mjs';

export function readSurfStoreReward(rewardId) {
  const reward = surfStoreRewards.find(item => item.id === rewardId && item.status !== 'ended');
  if (!reward || reward.minimumSbtBalance === null) throw new HttpError(400, 'surf_reward_invalid');
  return reward;
}

export async function readSurfStoreAccess(session, rewardId, {
  now = Date.now(), readHoldings = readHubMemberSbt, environment = process.env, forceRefresh = false,
} = {}) {
  if (!getStorefrontFeatures(environment, now).surfRewardsVisible) throw new HttpError(404, 'not_found');
  assertSurfStoreOpen(now);
  const reward = readSurfStoreReward(rewardId);
  const { wallet } = identity(session);
  if (session.user.isDemo) throw new HttpError(403, 'surf_demo_forbidden');
  const holdings = await readHoldings(session, { forceRefresh });
  if (!Number.isSafeInteger(holdings.sbtBadgeCount) || holdings.walletAddress?.toLowerCase() !== wallet) {
    throw new HttpError(502, 'surf_holdings_invalid');
  }
  if (holdings.sbtBadgeCount < reward.minimumSbtBalance) throw new HttpError(403, 'surf_sbt_required');
  return { rewardId: reward.id, minimumSbtBalance: reward.minimumSbtBalance,
    sbtBadgeCount: holdings.sbtBadgeCount, walletAddress: wallet, checkedAt: holdings.checkedAt };
}
