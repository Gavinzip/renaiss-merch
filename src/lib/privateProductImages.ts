import type {
  MerchAccessProductState
} from './merchAccessState';
import type { MerchProductId } from './merchProducts';

const PRIVATE_IMAGE_CACHE_PREFIX =
  'renaiss-merch-private-product-images:';
const PRIVATE_IMAGE_CACHE_ROUTE =
  '/.renaiss-private-product-image-cache';
const PRIVATE_IMAGE_RELEASE_HEADER =
  'X-Renaiss-Private-Media-Release';

export type PreparedPrivateProductImageUrls = Partial<
  Record<MerchProductId, string>
>;

let activeCacheRelease = '';
let cachePromise: Promise<Cache> | null = null;
let preparedRelease = '';
const preparedImagePromises = new Map<
  MerchProductId,
  Promise<string>
>();

export async function prepareEligiblePrivateProductImages(
  accessStates: readonly MerchAccessProductState[],
  mediaRelease: string
): Promise<PreparedPrivateProductImageUrls> {
  const eligibleProducts = accessStates.filter(
    (accessState) => accessState.status === 'eligible'
  );
  const entries = await Promise.all(
    eligibleProducts.map(async ({ productId }) => [
      productId,
      await preparePrivateProductImage(productId, mediaRelease)
    ] as const)
  );

  return Object.fromEntries(entries);
}

export function preparePrivateProductImage(
  productId: MerchProductId,
  mediaRelease: string
) {
  const release = requireMediaRelease(mediaRelease);

  if (preparedRelease !== release) {
    preparedRelease = release;
    preparedImagePromises.clear();
  }

  const existing = preparedImagePromises.get(productId);

  if (existing) {
    return existing;
  }

  const preparation = loadAndDecodePrivateProductImage(
    productId,
    release
  ).catch((error) => {
    if (preparedImagePromises.get(productId) === preparation) {
      preparedImagePromises.delete(productId);
    }

    throw error;
  });

  preparedImagePromises.set(productId, preparation);
  return preparation;
}

async function loadAndDecodePrivateProductImage(
  productId: MerchProductId,
  mediaRelease: string
) {
  const blob =
    (await readCachedPrivateProductImage(productId, mediaRelease)) ??
    (await downloadAndCachePrivateProductImage(
      productId,
      mediaRelease
    ));
  const objectUrl = URL.createObjectURL(blob);

  try {
    await decodeImage(objectUrl);
    return objectUrl;
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function readCachedPrivateProductImage(
  productId: MerchProductId,
  mediaRelease: string
) {
  const cache = await openPrivateProductImageCache(mediaRelease);
  const request = createCacheRequest(productId, mediaRelease);
  const response = await cache.match(request);

  if (!response) {
    return null;
  }

  if (
    response.headers.get(PRIVATE_IMAGE_RELEASE_HEADER) !==
    mediaRelease
  ) {
    await cache.delete(request);
    return null;
  }

  const blob = await response.blob();

  if (!isValidImageBlob(blob)) {
    await cache.delete(request);
    return null;
  }

  return blob;
}

async function downloadAndCachePrivateProductImage(
  productId: MerchProductId,
  mediaRelease: string
) {
  const response = await fetch(readPrivateImageEndpoint(productId), {
    cache: 'no-store',
    credentials: 'same-origin'
  });

  if (!response.ok) {
    throw new Error(
      `Private product image returned ${response.status}.`
    );
  }

  const blob = await response.blob();

  if (!isValidImageBlob(blob)) {
    throw new Error('Private product image response was invalid.');
  }

  const cache = await openPrivateProductImageCache(mediaRelease);
  await cache.put(
    createCacheRequest(productId, mediaRelease),
    new Response(blob, {
      headers: {
        'Content-Length': String(blob.size),
        'Content-Type': blob.type,
        [PRIVATE_IMAGE_RELEASE_HEADER]: mediaRelease
      }
    })
  );

  return blob;
}

async function openPrivateProductImageCache(mediaRelease: string) {
  if (activeCacheRelease !== mediaRelease || !cachePromise) {
    activeCacheRelease = mediaRelease;
    cachePromise = initializePrivateProductImageCache(mediaRelease);
  }

  return cachePromise;
}

async function initializePrivateProductImageCache(
  mediaRelease: string
) {
  if (!globalThis.isSecureContext || !globalThis.caches) {
    throw new Error(
      'Private product image storage requires a secure browser context.'
    );
  }

  const cacheName = `${PRIVATE_IMAGE_CACHE_PREFIX}${mediaRelease}`;
  const cacheNames = await globalThis.caches.keys();

  await Promise.all(
    cacheNames
      .filter(
        (existingName) =>
          existingName.startsWith(PRIVATE_IMAGE_CACHE_PREFIX) &&
          existingName !== cacheName
      )
      .map((existingName) => globalThis.caches.delete(existingName))
  );

  return globalThis.caches.open(cacheName);
}

function createCacheRequest(
  productId: MerchProductId,
  mediaRelease: string
) {
  const cacheUrl = new URL(
    [
      PRIVATE_IMAGE_CACHE_ROUTE,
      encodeURIComponent(mediaRelease),
      productId,
      readPrivateImageVariant(productId)
    ].join('/'),
    window.location.origin
  );

  return new Request(cacheUrl, {
    credentials: 'same-origin',
    method: 'GET'
  });
}

function readPrivateImageEndpoint(productId: MerchProductId) {
  const parameters = new URLSearchParams({ productId });

  if (productId === 'bracelet') {
    parameters.set('variant', 'store-cover');
  }

  return `/api/merch-reveal-thumbnail?${parameters.toString()}`;
}

function readPrivateImageVariant(productId: MerchProductId) {
  return productId === 'bracelet' ? 'store-cover' : 'default';
}

function requireMediaRelease(value: string) {
  const release = value.trim();

  if (!release) {
    throw new Error('Private product image release is missing.');
  }

  return release;
}

function isValidImageBlob(blob: Blob) {
  return blob.size > 0 && blob.type.startsWith('image/');
}

async function decodeImage(source: string) {
  const image = new Image();
  image.decoding = 'async';
  image.src = source;
  await image.decode();

  if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new Error('Private product image could not be decoded.');
  }
}
