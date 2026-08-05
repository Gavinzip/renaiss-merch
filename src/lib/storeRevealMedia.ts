import {
  MERCH_PRODUCT_IDS,
  type MerchProductId
} from './merchProducts';
import {
  prepareRevealMedia,
  type PreparedRevealMedia,
  type RevealMediaAdmissionProgress,
  type RevealMediaAdmissionStage
} from './revealMediaPreload';

type PreparedMediaMap = Partial<
  Record<MerchProductId, PreparedRevealMedia>
>;
type PendingMediaMap = Partial<
  Record<MerchProductId, Promise<PreparedRevealMedia>>
>;
type ProgressMap = Partial<
  Record<MerchProductId, RevealMediaAdmissionProgress>
>;

export type StoreRevealMediaController = ReturnType<
  typeof createStoreRevealMediaController
>;

export class StoreRevealMediaCancelledError extends Error {
  constructor() {
    super('Store reveal media preparation was cancelled.');
    this.name = 'StoreRevealMediaCancelledError';
  }
}

export function createStoreRevealMediaController() {
  const preparedMedia: PreparedMediaMap = {};
  const pendingMedia: PendingMediaMap = {};
  let admissionComplete = false;
  let generation = 0;

  async function prepareAll(
    onProgress: (progress: RevealMediaAdmissionProgress) => void
  ) {
    const productProgress: ProgressMap = {};
    let highestPercent = 0;

    function updateOverallProgress() {
      const entries = Object.values(productProgress).filter(
        (progress): progress is RevealMediaAdmissionProgress => !!progress
      );
      const totalBytes = entries.reduce(
        (total, progress) => total + progress.totalBytes,
        0
      );
      const loadedBytes = entries.reduce(
        (total, progress) => total + progress.loadedBytes,
        0
      );
      const weightedPercent = totalBytes
        ? entries.reduce(
            (total, progress) =>
              total + progress.percent * progress.totalBytes,
            0
          ) / totalBytes
        : 0;
      const percent = Math.min(
        99,
        Math.max(highestPercent, Math.round(weightedPercent))
      );

      highestPercent = percent;
      onProgress({
        loadedBytes,
        percent,
        stage: readOverallStage(entries),
        totalBytes
      });
    }

    onProgress({
      loadedBytes: 0,
      percent: 0,
      stage: 'download',
      totalBytes: 0
    });

    await Promise.all(
      MERCH_PRODUCT_IDS.map(async (productId) => {
        await prepareProduct(productId, (progress) => {
          productProgress[productId] = progress;
          updateOverallProgress();
        });
      })
    );

    const finalEntries = Object.values(productProgress).filter(
      (progress): progress is RevealMediaAdmissionProgress => !!progress
    );

    onProgress({
      loadedBytes: finalEntries.reduce(
        (total, progress) => total + progress.totalBytes,
        0
      ),
      percent: 100,
      stage: 'render',
      totalBytes: finalEntries.reduce(
        (total, progress) => total + progress.totalBytes,
        0
      )
    });
    admissionComplete = true;
  }

  async function prepareProduct(
    productId: MerchProductId,
    onProgress: (progress: RevealMediaAdmissionProgress) => void
  ) {
    const prepared = preparedMedia[productId];

    if (prepared) {
      return prepared;
    }

    const pending = pendingMedia[productId];

    if (pending) {
      await pending;
      return prepareProduct(productId, onProgress);
    }

    const requestGeneration = generation;
    const request = prepareRevealMedia(productId, onProgress);
    pendingMedia[productId] = request;

    try {
      const result = await request;

      if (requestGeneration !== generation) {
        result.release();
        throw new StoreRevealMediaCancelledError();
      }

      preparedMedia[productId] = result;
      return result;
    } finally {
      if (pendingMedia[productId] === request) {
        delete pendingMedia[productId];
      }
    }
  }

  function read(productId: MerchProductId) {
    return preparedMedia[productId];
  }

  function isAdmissionComplete() {
    return admissionComplete;
  }

  function releaseAll() {
    generation += 1;
    admissionComplete = false;
    const released = new Set<PreparedRevealMedia>();

    for (const productId of MERCH_PRODUCT_IDS) {
      const prepared = preparedMedia[productId];

      if (prepared && !released.has(prepared)) {
        prepared.release();
        released.add(prepared);
      }

      delete preparedMedia[productId];
      delete pendingMedia[productId];
    }
  }

  return {
    isAdmissionComplete,
    prepareAll,
    prepareProduct,
    read,
    releaseAll
  };
}

function readOverallStage(
  entries: readonly RevealMediaAdmissionProgress[]
): RevealMediaAdmissionStage {
  if (entries.some((progress) => progress.stage === 'download')) {
    return 'download';
  }

  if (entries.some((progress) => progress.stage === 'decode')) {
    return 'decode';
  }

  return 'render';
}
