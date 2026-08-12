import assetRelease from '../../media/public-asset-release.json';

export type StaticMerchAsset =
  | 'renaissLogoMark'
  | 'renaissProtocolLogo'
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
  renaissLogoMark:
    '/src/assets/brand/website/renaiss-logo-mark.png',
  renaissProtocolLogo:
    '/src/assets/brand/website/renaiss-protocol-logo.png',
  braceletSealedDrop:
    '/src/assets/merch/products/bracelet/website/box-closed.png',
  sealedDrop:
    '/src/assets/merch/products/shirt/website/box-card.jpg',
  sealedDropCatalog:
    '/src/assets/merch/products/shirt/website/box-catalog.png',
  storeBackground:
    '/src/assets/merch/shared/website/store-background.png'
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

export function applyStaticMerchFavicon() {
  const favicon = document.createElement('link');
  const existingFavicon = document.querySelector<HTMLLinkElement>(
    'link[rel="icon"]'
  );

  favicon.rel = 'icon';
  favicon.type = 'image/avif';
  favicon.href = staticMerchAssetUrl('renaissLogoMark');

  if (existingFavicon) {
    existingFavicon.replaceWith(favicon);
  } else {
    document.head.append(favicon);
  }
}
