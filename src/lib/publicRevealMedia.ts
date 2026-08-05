import assetRelease from '../../media/public-asset-release.json';
import type { MerchProductId } from './merchProducts';

export type RevealDirection = 'forward' | 'reverse';

type RevealAssetKey =
  `${MerchProductId}Reveal${'Forward' | 'Reverse'}`;

const configuredCdnBase = String(
  import.meta.env.VITE_STATIC_ASSET_CDN_BASE_URL || ''
)
  .trim()
  .replace(/\/+$/, '');

export const publicRevealMediaRelease = assetRelease.release;

export function publicRevealMediaUrl(
  productId: MerchProductId,
  direction: RevealDirection
) {
  const assetKey = readRevealAssetKey(productId, direction);

  if (import.meta.env.DEV) {
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
  productId: MerchProductId,
  direction: RevealDirection
): RevealAssetKey {
  const suffix = direction === 'forward' ? 'Forward' : 'Reverse';

  return `${productId}Reveal${suffix}`;
}
