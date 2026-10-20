import release from '../../../media/event-experience-asset-release.json';

const cdnBase = String(import.meta.env.VITE_STATIC_ASSET_CDN_BASE_URL || '').trim().replace(/\/+$/, '');
export function archiveAssetUrl(key) {
  const asset = release.assets[key];
  if (!asset) throw new Error('Unknown archived event asset: ' + key);
  if (import.meta.env.DEV) return '/work/assets/event-experiences/' + asset.path;
  if (!cdnBase || release.release === 'unpublished') throw new Error('Publish the archived event runtime assets to R2/CDN before production.');
  return cdnBase + '/' + release.prefix + '/' + release.release + '/' + asset.path;
}

export function hubArchiveUrl(locale) {
  const url = new URL('/v1.2/', window.location.origin);
  url.searchParams.set('preview', 'hub');
  url.searchParams.set('lang', locale === 'zh-Hant' ? 'zh-TW' : locale);
  url.hash = 'events';
  return url.pathname + url.search + url.hash;
}

export function installPokemonFonts() {
  const style = document.createElement('style');
  style.textContent = ['Inter', 'Urbanist'].map(family => `@font-face { font-family: '${family} Variable'; font-style: normal; font-weight: 100 900; font-display: swap; src: url('${archiveAssetUrl('pokemon-30/fonts/' + family.toLowerCase() + '.woff2')}') format('woff2'); }`).join('\n');
  document.head.appendChild(style);
}
