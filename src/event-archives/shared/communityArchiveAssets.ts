import release from '../../../media/community-event-archive-asset-release.json';
const cdnBase = String(import.meta.env.VITE_STATIC_ASSET_CDN_BASE_URL || '').trim().replace(/\/+$/, '');

export function communityArchiveAssetUrl(key: string) {
  const asset = (release.assets as Record<string, {path:string}>)[key];
  if (!asset) throw new Error('Unknown community archive asset: ' + key);
  if (import.meta.env.DEV) return '/work/assets/community-event-archives/' + asset.path;
  if (import.meta.env.MODE === 'local-preview') return '/local-event-archive-assets/' + asset.path;
  if (!cdnBase || release.release === 'unpublished') throw new Error('Publish the community event archive media to R2/CDN before release.');
  return cdnBase + '/' + release.prefix + '/' + release.release + '/' + asset.path;
}
