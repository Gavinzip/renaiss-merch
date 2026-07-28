import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const catalog = JSON.parse(
  readFileSync(new URL('../media/asset-release.json', import.meta.url), 'utf8')
);
const projectRootUrl = new URL('../', import.meta.url);
const existingShirtRevealBase =
  'https://pub-152183cd35ab428096bc92f48b651a94.r2.dev/merch/reveal';

const existingShirtRevealAssets = {
  shirtRevealForward: {
    contentType: 'video/mp4',
    remoteUrl: `${existingShirtRevealBase}/merch-claim-reveal.mp4?v=20260627`
  },
  shirtRevealReverse: {
    contentType: 'video/mp4',
    remoteUrl:
      `${existingShirtRevealBase}/merch-claim-reveal-reverse.mp4?v=20260627`
  }
};

export function getMerchMediaAsset(assetKey) {
  const existingAsset = existingShirtRevealAssets[assetKey];

  if (existingAsset) {
    return {
      contentType: existingAsset.contentType,
      remoteUrl: existingAsset.remoteUrl,
      type: 'remote'
    };
  }

  const asset = catalog.assets[assetKey];

  if (!asset) {
    throw new Error(`Unknown merch media asset: ${assetKey}`);
  }

  if (process.env.NODE_ENV !== 'production') {
    return {
      contentType: asset.sourceContentType,
      filePath: fileURLToPath(new URL(asset.source, projectRootUrl)),
      type: 'local'
    };
  }

  const configuredBase = String(
    process.env.STATIC_ASSET_CDN_BASE_URL ||
      process.env.VITE_STATIC_ASSET_CDN_BASE_URL ||
      ''
  )
    .trim()
    .replace(/\/+$/, '');

  if (!configuredBase || catalog.release === 'unpublished') {
    throw new Error(
      'Production merch media is not configured. Set ' +
        'STATIC_ASSET_CDN_BASE_URL and publish the checked-in media release.'
    );
  }

  const releasePath = [catalog.prefix, catalog.release, asset.path]
    .map((part) => String(part).replace(/^\/+|\/+$/g, ''))
    .join('/');

  return {
    contentType: asset.contentType,
    remoteUrl: `${configuredBase}/${releasePath}`,
    type: 'remote'
  };
}
