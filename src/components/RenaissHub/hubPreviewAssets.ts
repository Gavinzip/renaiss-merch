import { hubAssetUrl } from '../../lib/hubAssets';

// Reviewed artwork resolves locally in development and to versioned CDN media
// in the deployed hidden home. There is no production local-media substitute.
export function hubPreviewLogoUrl() {
  return hubAssetUrl('displayLogo');
}

// Exact supplied black lockup, including the official wordmark. Publish this
// artwork to versioned R2/CDN before release, as with the other preview assets.
export function hubPreviewWordmarkUrl() {
  return hubAssetUrl('wordmark');
}

// Exact official profile asset; no redraw. This preview must not publish a
// local media URL in production. Release it through the versioned R2 manifest.
export function surfPreviewLogoUrl() {
  return hubAssetUrl('surfLogo');
}
