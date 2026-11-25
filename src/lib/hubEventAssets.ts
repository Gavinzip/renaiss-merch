import release from '../../media/hub-event-asset-release.json';
import type { ArchiveEventId } from '../components/RenaissHub/useHubArchiveRoute';
import { hubAssetUrl } from './hubAssets';

type PosterEventId = Exclude<ArchiveEventId, 'worlds-2026' | 'bbw'>;
const developmentPaths: Record<Exclude<PosterEventId, 'surf'>, string> = {
  football: '/work/assets/event-archive/football.webp',
  'pokemon-30': '/work/assets/event-archive/pokemon30.jpg',
};
const cdnBase = String(import.meta.env.VITE_STATIC_ASSET_CDN_BASE_URL || '').trim().replace(/\/+$/, '');

export function hubEventAssetUrl(id: PosterEventId) {
  if (id === 'surf') return hubAssetUrl('surfBox');
  if (import.meta.env.DEV) return developmentPaths[id];
  if (!cdnBase || release.release === 'unpublished') {
    throw new Error('Publish the event archive media to R2 and configure its release before deployment.');
  }
  return cdnBase + '/' + release.prefix + '/' + release.release + '/' + release.assets[id].path;
}
