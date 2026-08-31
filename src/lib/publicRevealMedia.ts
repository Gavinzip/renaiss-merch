import assetRelease from '../../media/public-asset-release.json';
import type { PublicRevealProductId } from './merchProducts';

export type RevealDirection = 'forward' | 'reverse';

type RevealAssetKey =
  | 'braceletRevealForward'
  | 'braceletRevealReverse'
  | 'shirtRevealForward'
  | 'shirtRevealReverse'
  | 'ticketRevealForward';

const configuredCdnBase = String(
  import.meta.env.VITE_STATIC_ASSET_CDN_BASE_URL || ''
)
  .trim()
  .replace(/\/+$/, '');

export const publicRevealMediaRelease = assetRelease.release;

export function publicRevealMediaUrl(
  productId: PublicRevealProductId,
  direction: RevealDirection
) {
  const assetKey = readRevealAssetKey(productId, direction);

  if (import.meta.env.DEV) {
    if (productId === 'ticket') {
      return (
        '/private/merch/products/ticket/website/videos/' +
        'reveal-forward-scrub.mp4'
      );
    }

    return (
      `/private/merch/runtime/${productId}/` +
      `reveal-${direction}.mp4`
    );
  }

  if (!configuredCdnBase || assetRelease.release === 'unpublished') {
    throw new Error(
      'Public reveal media is not configured. Publish the R2 release and ' +
        'set VITE_STATIC_ASSET_CDN_BASE_URL before building for production.'
    );
  }

  const asset = assetRelease.assets[assetKey];
  const releasePath = [
    assetRelease.prefix,
    assetRelease.release,
    asset.path
  ]
    .map((part) => String(part).replace(/^\/+|\/+$/g, ''))
    .join('/');

  return `${configuredCdnBase}/${releasePath}`;
}

function readRevealAssetKey(
  productId: PublicRevealProductId,
  direction: RevealDirection
): RevealAssetKey {
  if (productId === 'ticket') {
    return 'ticketRevealForward';
  }

  const suffix = direction === 'forward' ? 'Forward' : 'Reverse';

  return `${productId}Reveal${suffix}`;
}
