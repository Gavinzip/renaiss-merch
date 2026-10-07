import release from '../../media/hub-asset-release.json';

type HubAsset = keyof typeof release.assets;
const developmentPaths: Record<HubAsset, string> = {
  displayLogo: '/work/generated-images/2026-10-06-renaiss-logo/02-renaiss-logo-transparent.png',
  wordmark: '/src/assets/brand/website/renaiss-logo-black.png',
  surfLogo: '/src/assets/brand/partners/surf-ai-avatar.jpg',
  surfBox: '/work/assets/surf/surf-mystery-box-clear-v1.webp',
  surfProduct: '/work/research/surf-campaign-2026-10-06/display/surf-product.webp',
  sealedBoxHero: '/work/videos/merch-hub-loop/assets/sealed-box.avif'
};
const cdnBase = String(import.meta.env.VITE_STATIC_ASSET_CDN_BASE_URL || '').trim().replace(/\/+$/, '');

export function hubAssetUrl(key: HubAsset) {
  if (import.meta.env.DEV) return developmentPaths[key];
  if (!cdnBase || release.release === 'unpublished') {
    throw new Error('Publish the Hub media release and configure VITE_STATIC_ASSET_CDN_BASE_URL before deployment.');
  }
  return `${cdnBase}/${release.prefix}/${release.release}/${release.assets[key].path}`;
}
