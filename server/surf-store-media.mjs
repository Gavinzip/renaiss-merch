import { readFileSync } from 'node:fs';
import { HttpError } from './http.mjs';
import { createPrivateMediaSignedUrl } from './private-media-signed-url.mjs';
import { readSurfStoreAccess } from './surf-store-access.mjs';

const catalog = JSON.parse(readFileSync(new URL('../media/surf-reveal-asset-release.json', import.meta.url), 'utf8'));

export async function readSurfStoreMediaUrls(session, authorize = readSurfStoreAccess) {
  await authorize(session, 'mystery-box');
  const origin = process.env.PRIVATE_MEDIA_ORIGIN?.trim().replace(/\/+$/, '');
  const secret = process.env.PRIVATE_MEDIA_PROXY_TOKEN?.trim();
  if (!origin || !secret || new URL(origin).protocol !== 'https:') throw new HttpError(503, 'surf_reveal_not_configured');
  if (catalog.release === 'unpublished') throw new HttpError(503, 'surf_reveal_unpublished');
  // Return control-plane data only. The browser fetches all bodies directly from Cloudflare.
  const assets = Object.fromEntries(Object.entries(catalog.assets).map(([key, asset]) => [key,
    createPrivateMediaSignedUrl({ remoteUrl: `${origin}/${catalog.prefix}/${catalog.release}/${asset.path}`, signingSecret: secret })]));
  return { assets };
}
