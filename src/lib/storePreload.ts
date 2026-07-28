import {
  staticMerchAssetUrl,
  type StaticMerchAsset
} from './staticAssets';

const STORE_ENTRY_ASSETS: readonly StaticMerchAsset[] = [
  'storeBackground',
  'sealedDrop',
  'sealedDropCatalog'
];

export async function preloadStoreAssets(
  onProgress: (progress: number) => void
) {
  let loadedAssets = 0;

  onProgress(0);

  await Promise.all(
    STORE_ENTRY_ASSETS.map(async (assetKey) => {
      await preloadImage(staticMerchAssetUrl(assetKey));
      loadedAssets += 1;
      onProgress(
        loadedAssets === STORE_ENTRY_ASSETS.length
          ? 100
          : Math.round((loadedAssets / STORE_ENTRY_ASSETS.length) * 99)
      );
    })
  );
}

function preloadImage(source: string) {
  return new Promise<HTMLImageElement>((resolvePromise, rejectPromise) => {
    const image = new Image();

    image.decoding = 'async';
    image.onload = () => resolvePromise(image);
    image.onerror = () => {
      rejectPromise(new Error(`Store asset could not be loaded: ${source}`));
    };
    image.src = source;

    if (image.complete && image.naturalWidth > 0) {
      resolvePromise(image);
    }
  }).then(async (image) => {
    await image.decode();
  });
}
