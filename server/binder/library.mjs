import { HttpError } from '../http.mjs';
import { readMerchEligibility } from '../eligibility.mjs';
import { readSbtBadgeCatalog } from '../sbt-catalog.mjs';
import { binderBadgeMedia } from './media.mjs';

export async function readBinderLibrary(session, { forceRefresh = false } = {}) {
  if (!session?.user?.sub) throw new HttpError(401, 'authentication_required');
  if (session.user.isDemo) throw new HttpError(403, 'binder_requires_real_account');
  const [holdings, catalog] = await Promise.all([
    readMerchEligibility(session, { productId: 'shirt', includeBalances: true, forceRefresh }),
    readSbtBadgeCatalog(),
  ]);
  const byId = new Map(catalog.badges.map(badge => [String(badge.id), badge]));
  const badges = Object.entries(holdings.balances).map(([tokenId, balance]) => {
    const badge = byId.get(tokenId);
    if (!badge) throw new HttpError(502, 'binder_badge_metadata_missing');
    return { tokenId, name: badge.name, description: badge.description, howToEarn: badge.howToEarn,
      imageUrl: binderBadgeMedia(tokenId), balance };
  });
  return { badges, walletAddress: holdings.walletAddress, checkedAt: holdings.verifiedAt };
}
