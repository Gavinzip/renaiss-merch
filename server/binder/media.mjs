import release from '../../media/member-binder-badges-release.json' with { type: 'json' };
import { HttpError } from '../http.mjs';

// Missing/unpublished media is an actionable release failure, never a switch
// back to application-server streaming or a different media origin.
export function binderBadgeMedia(tokenId) {
  const origin = String(process.env.VITE_STATIC_ASSET_CDN_BASE_URL || '').replace(/\/+$/, '');
  const asset = release.assets[String(tokenId)];
  if (!origin || !release.release || !asset?.encodedSha256)
    throw new HttpError(502, 'binder_badge_media_not_published');
  return `${origin}/${release.prefix}/${release.release}/${asset.path}`;
}
