import type { MerchProductId } from './merchProducts';
import { publicRevealMediaRelease } from './publicRevealMedia';

const REVEAL_MEDIA_CACHE_PREFIX = 'renaiss-merch-reveal-media:';
const REVEAL_MEDIA_CACHE_NAME =
  `${REVEAL_MEDIA_CACHE_PREFIX}${publicRevealMediaRelease}`;
const REVEAL_MEDIA_CACHE_ROUTE = '/.renaiss-reveal-media-cache';
const REVEAL_MEDIA_RELEASE_HEADER = 'X-Renaiss-Reveal-Media-Release';

type RevealDirection = 'forward' | 'reverse';

export type CachedRevealMedia = {
  blob: Blob;
  contentType: string;
  expectedSize: number;
};

let cachePromise: Promise<Cache> | null = null;

export async function readCachedRevealMedia(
  productId: MerchProductId,
  direction: RevealDirection
): Promise<CachedRevealMedia | null> {
  const cache = await openRevealMediaCache();
  const request = createCacheRequest(productId, direction);
  const response = await cache.match(request);

  if (!response) {
    return null;
  }

  if (
    response.headers.get(REVEAL_MEDIA_RELEASE_HEADER) !==
    publicRevealMediaRelease
  ) {
    await cache.delete(request);
    return null;
  }

  const blob = await response.blob();

  if (blob.size <= 0) {
    await cache.delete(request);
    return null;
  }

  return {
    blob,
    contentType: blob.type || 'video/mp4',
    expectedSize: blob.size
  };
}

export async function saveCachedRevealMedia(
  productId: MerchProductId,
  direction: RevealDirection,
  media: CachedRevealMedia
) {
  const cache = await openRevealMediaCache();
  const request = createCacheRequest(productId, direction);
  const response = new Response(media.blob, {
    headers: {
      'Content-Length': String(media.expectedSize),
      'Content-Type': media.contentType,
      [REVEAL_MEDIA_RELEASE_HEADER]: publicRevealMediaRelease
    }
  });

  await cache.put(request, response);
}

export async function deleteCachedRevealMedia(
  productId: MerchProductId,
  direction: RevealDirection
) {
  const cache = await openRevealMediaCache();
  await cache.delete(createCacheRequest(productId, direction));
}

async function openRevealMediaCache() {
  if (!cachePromise) {
    cachePromise = initializeRevealMediaCache();
  }

  return cachePromise;
}

async function initializeRevealMediaCache() {
  if (!globalThis.isSecureContext || !globalThis.caches) {
    throw new Error(
      'Persistent reveal media storage requires a secure browser context.'
    );
  }

  const cacheNames = await globalThis.caches.keys();

  await Promise.all(
    cacheNames
      .filter(
        (cacheName) =>
          (cacheName.startsWith(REVEAL_MEDIA_CACHE_PREFIX) ||
            cacheName.startsWith('renaiss-merch-private-media:')) &&
          cacheName !== REVEAL_MEDIA_CACHE_NAME
      )
      .map((cacheName) => globalThis.caches.delete(cacheName))
  );

  return globalThis.caches.open(REVEAL_MEDIA_CACHE_NAME);
}

function createCacheRequest(
  productId: MerchProductId,
  direction: RevealDirection
) {
  const cacheUrl = new URL(
    `${REVEAL_MEDIA_CACHE_ROUTE}/${publicRevealMediaRelease}/${productId}/${direction}`,
    window.location.origin
  );

  return new Request(cacheUrl, {
    credentials: 'same-origin',
    method: 'GET'
  });
}
