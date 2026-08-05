import assetRelease from '../../media/public-asset-release.json';

export type StaticMerchAsset =
  | 'braceletSealedDrop'
  | 'sealedDrop'
  | 'sealedDropCatalog'
  | 'storeBackground';

const configuredCdnBase = String(
  import.meta.env.VITE_STATIC_ASSET_CDN_BASE_URL || ''
)
  .trim()
  .replace(/\/+$/, '');

const developmentPaths: Record<StaticMerchAsset, string> = {
  braceletSealedDrop:
    '/src/assets/merch/storefront/bracelet-box-closed.png',
  sealedDrop: '/src/assets/merch/storefront/shirt-box-card.jpg',
  sealedDropCatalog:
    '/src/assets/merch/storefront/shirt-box-catalog.png',
  storeBackground:
    '/src/assets/merch/storefront/store-background.png'
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
