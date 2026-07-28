import assetRelease from '../../media/asset-release.json';

export type StaticMerchAsset = 'sealedDrop' | 'storeBackground';

const configuredCdnBase = String(
  import.meta.env.VITE_STATIC_ASSET_CDN_BASE_URL || ''
)
  .trim()
  .replace(/\/+$/, '');

const developmentPaths: Record<StaticMerchAsset, string> = {
  sealedDrop: '/src/assets/merch/sealed-drop.jpg',
  storeBackground: '/src/assets/merch/store-static-background-v2.jpg'
};

export function staticMerchAssetUrl(assetKey: StaticMerchAsset) {
  if (import.meta.env.DEV) {
    return developmentPaths[assetKey];
  }

  if (!configuredCdnBase || assetRelease.release === 'unpublished') {
    throw new Error(
      'Static merch media is not configured. Publish the R2 release and set ' +
        'VITE_STATIC_ASSET_CDN_BASE_URL before building for production.'
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

export function staticMerchAssetCssUrl(assetKey: StaticMerchAsset) {
  return `url("${staticMerchAssetUrl(assetKey)}")`;
}
