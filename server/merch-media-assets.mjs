import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const catalog = JSON.parse(
  readFileSync(
    new URL('../media/private-asset-release.json', import.meta.url),
    'utf8'
  )
);
const projectRootUrl = new URL('../', import.meta.url);

export function getMerchMediaAsset(assetKey) {
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

  const privateMediaOrigin = normalizePrivateMediaOrigin(
    process.env.PRIVATE_MEDIA_ORIGIN
  );
  const privateMediaToken = String(
    process.env.PRIVATE_MEDIA_PROXY_TOKEN || ''
  )
    .trim();

  if (
    !privateMediaOrigin ||
    !privateMediaToken ||
    catalog.release === 'unpublished'
  ) {
    throw new Error(
      'Private merch media is not configured. Set PRIVATE_MEDIA_ORIGIN and ' +
        'PRIVATE_MEDIA_PROXY_TOKEN, then publish the private media release.'
    );
  }

  const releasePath = [catalog.prefix, catalog.release, asset.path]
    .map((part) => String(part).replace(/^\/+|\/+$/g, ''))
    .join('/');

  return {
    contentType: asset.contentType,
    remoteUrl: `${privateMediaOrigin}/${releasePath}`,
    signingSecret: privateMediaToken,
    type: 'signed-remote'
  };
}

export function getPrivateMerchMediaRelease() {
  return catalog.release;
}

function normalizePrivateMediaOrigin(value) {
  const configuredOrigin = String(value || '').trim().replace(/\/+$/, '');

  if (!configuredOrigin) {
    return '';
  }

  const url = new URL(configuredOrigin);

  if (url.protocol !== 'https:') {
    throw new Error('PRIVATE_MEDIA_ORIGIN must use HTTPS.');
  }

  return url.toString().replace(/\/$/, '');
}
