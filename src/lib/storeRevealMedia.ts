import {
  PUBLIC_REVEAL_PRODUCT_IDS,
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
type ProgressListener = (
  progress: RevealMediaAdmissionProgress
) => void;
type ProgressListenerMap = Partial<
  Record<MerchProductId, Set<ProgressListener>>
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
  const latestProgress: ProgressMap = {};
  const progressListeners: ProgressListenerMap = {};
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
      PUBLIC_REVEAL_PRODUCT_IDS.map(async (productId) => {
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
    const unsubscribe = subscribeToProgress(productId, onProgress);

    try {
      const prepared = preparedMedia[productId];

      if (prepared) {
        onProgress(
          latestProgress[productId] || readCompletedProgress()
        );
        return prepared;
      }

      let request = pendingMedia[productId];

      if (!request) {
        const requestGeneration = generation;
        request = prepareRevealMedia(productId, (progress) => {
          publishProgress(productId, progress);
        })
          .then((result) => {
            if (requestGeneration !== generation) {
              result.release();
              throw new StoreRevealMediaCancelledError();
            }

            preparedMedia[productId] = result;
            admissionComplete = PUBLIC_REVEAL_PRODUCT_IDS.every(
              (publicProductId) => !!preparedMedia[publicProductId]
            );
            return result;
          })
          .finally(() => {
            if (pendingMedia[productId] === request) {
              delete pendingMedia[productId];
            }
          });
        pendingMedia[productId] = request;
      }

      return await request;
    } finally {
      unsubscribe();
    }
  }

  function subscribeToProgress(
    productId: MerchProductId,
    listener: ProgressListener
  ) {
    const listeners =
      progressListeners[productId] || new Set<ProgressListener>();
    progressListeners[productId] = listeners;
    listeners.add(listener);

    const progress = latestProgress[productId];

    if (progress) {
      listener(progress);
    }

    return () => {
      listeners.delete(listener);
    };
  }

  function publishProgress(
    productId: MerchProductId,
    progress: RevealMediaAdmissionProgress
  ) {
    latestProgress[productId] = progress;
    progressListeners[productId]?.forEach((listener) => {
      listener(progress);
    });
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

    for (const productId of PUBLIC_REVEAL_PRODUCT_IDS) {
      const prepared = preparedMedia[productId];

      if (prepared && !released.has(prepared)) {
        prepared.release();
        released.add(prepared);
      }

      delete preparedMedia[productId];
      delete pendingMedia[productId];
      delete latestProgress[productId];
      progressListeners[productId]?.clear();
      delete progressListeners[productId];
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

function readCompletedProgress(): RevealMediaAdmissionProgress {
  return {
    loadedBytes: 1,
    percent: 100,
    stage: 'render',
    totalBytes: 1
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
