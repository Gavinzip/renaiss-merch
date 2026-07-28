import {
  staticMerchAssetUrl,
  type StaticMerchAsset
} from './staticAssets';

const STORE_ENTRY_ASSETS: readonly StaticMerchAsset[] = [
  'storeBackground',
  'sealedDrop'
];
const MINIMUM_LOADING_DURATION_MS = 720;
const COMPLETION_HOLD_MS = 160;

export async function preloadStoreAssets(
  onProgress: (progress: number) => void
) {
  const startedAt = performance.now();
  let loadedAssets = 0;

  onProgress(8);

  await Promise.all(
    STORE_ENTRY_ASSETS.map(async (assetKey) => {
      await preloadImage(staticMerchAssetUrl(assetKey));
      loadedAssets += 1;
      onProgress(8 + Math.round((loadedAssets / STORE_ENTRY_ASSETS.length) * 80));
    })
  );

  const remainingDuration = Math.max(
    0,
    MINIMUM_LOADING_DURATION_MS - (performance.now() - startedAt)
  );
  await wait(remainingDuration);
  onProgress(100);
  await wait(COMPLETION_HOLD_MS);
}

function preloadImage(source: string) {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const image = new Image();

    image.decoding = 'async';
    image.onload = () => resolvePromise();
    image.onerror = () => {
      rejectPromise(new Error(`Store asset could not be loaded: ${source}`));
    };
    image.src = source;

    if (image.complete && image.naturalWidth > 0) {
      resolvePromise();
    }
  });
}

function wait(durationMs: number) {
  return new Promise<void>((resolvePromise) => {
    window.setTimeout(resolvePromise, durationMs);
  });
}
