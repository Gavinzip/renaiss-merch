import type { MerchProductId } from './merchProducts';
import {
  publicRevealMediaUrl,
  type RevealDirection
} from './publicRevealMedia';
import {
  deleteCachedRevealMedia,
  readCachedRevealMedia,
  saveCachedRevealMedia,
  type CachedRevealMedia
} from './revealMediaCache';

const REVEAL_DIRECTIONS: readonly RevealDirection[] = [
  'forward',
  'reverse'
];
const DOWNLOAD_PROGRESS_MAX = 88;
const MEDIA_EVENT_TIMEOUT_MS = 8000;
const VIDEO_WARMUP_CHECKPOINTS = [0, 0.2, 0.4, 0.6, 0.8, 0.995] as const;

export type RevealMediaAdmissionStage = 'download' | 'decode' | 'render';

export type RevealMediaAdmissionProgress = {
  loadedBytes: number;
  percent: number;
  stage: RevealMediaAdmissionStage;
  totalBytes: number;
};

export type PreparedRevealMedia = {
  forwardUrl: string;
  release: () => void;
  reverseUrl: string;
};

class RevealMediaDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RevealMediaDecodeError';
  }
}

export async function prepareRevealMedia(
  productId: MerchProductId,
  onProgress: (progress: RevealMediaAdmissionProgress) => void
): Promise<PreparedRevealMedia> {
  const sources = Object.fromEntries(
    REVEAL_DIRECTIONS.map((direction) => [
      direction,
      publicRevealMediaUrl(productId, direction)
    ])
  ) as Record<RevealDirection, string>;
  const sizes: Record<RevealDirection, number> = {
    forward: 0,
    reverse: 0
  };
  const loadedBytes: Record<RevealDirection, number> = {
    forward: 0,
    reverse: 0
  };

  onProgress({
    loadedBytes: 0,
    percent: 0,
    stage: 'download',
    totalBytes: 0
  });

  const cachedMedia = Object.fromEntries(
    await Promise.all(
      REVEAL_DIRECTIONS.map(async (direction) => {
        const cached = await readCachedRevealMedia(productId, direction);

        return [direction, cached];
      })
    )
  ) as Record<RevealDirection, CachedRevealMedia | null>;

  const mediaSources = Object.fromEntries(
    await Promise.all(
      REVEAL_DIRECTIONS.map(async (direction) => {
        const cached = cachedMedia[direction];

        if (cached) {
          sizes[direction] = cached.expectedSize;
          loadedBytes[direction] = cached.expectedSize;
          return [
            direction,
            {
              cached,
              type: 'cached'
            }
          ];
        }

        const download = await openMediaDownload(sources[direction]);

        sizes[direction] = download.expectedSize;
        return [
          direction,
          {
            download,
            type: 'download'
          }
        ];
      })
    )
  ) as Record<RevealDirection, OpenMediaSource>;
  const totalBytes = sizes.forward + sizes.reverse;
  const initiallyLoadedBytes =
    loadedBytes.forward + loadedBytes.reverse;

  onProgress({
    loadedBytes: initiallyLoadedBytes,
    percent: Math.min(
      DOWNLOAD_PROGRESS_MAX,
      Math.max(
        1,
        Math.round(
          (initiallyLoadedBytes / totalBytes) * DOWNLOAD_PROGRESS_MAX
        )
      )
    ),
    stage: 'download',
    totalBytes
  });

  const blobs = Object.fromEntries(
    await Promise.all(
      REVEAL_DIRECTIONS.map(async (direction) => [
        direction,
        await readMediaBlob(
          productId,
          direction,
          mediaSources[direction],
          (loaded) => {
            loadedBytes[direction] = loaded;
            const loadedTotal =
              loadedBytes.forward + loadedBytes.reverse;

            onProgress({
              loadedBytes: loadedTotal,
              percent: Math.min(
                DOWNLOAD_PROGRESS_MAX,
                Math.max(
                  1,
                  Math.round(
                    (loadedTotal / totalBytes) * DOWNLOAD_PROGRESS_MAX
                  )
                )
              ),
              stage: 'download',
              totalBytes
            });
          }
        )
      ])
    )
  ) as Record<RevealDirection, Blob>;
  const forwardUrl = URL.createObjectURL(blobs.forward);
  const reverseUrl = URL.createObjectURL(blobs.reverse);
  const release = createReleaseHandler([forwardUrl, reverseUrl]);

  try {
    onProgress({
      loadedBytes: totalBytes,
      percent: 90,
      stage: 'decode',
      totalBytes
    });
    await Promise.all(
      REVEAL_DIRECTIONS.map(async (direction) => {
        const source =
          direction === 'forward' ? forwardUrl : reverseUrl;

        try {
          await warmRevealVideo(source);
        } catch (error) {
          if (error instanceof RevealMediaDecodeError) {
            await deleteCachedRevealMedia(productId, direction);
          }

          throw error;
        }
      })
    );
    onProgress({
      loadedBytes: totalBytes,
      percent: 100,
      stage: 'render',
      totalBytes
    });

    return {
      forwardUrl,
      release,
      reverseUrl
    };
  } catch (error) {
    release();
    throw error;
  }
}

type OpenMediaDownload = {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  expectedSize: number;
};

type OpenMediaSource =
  | {
      cached: CachedRevealMedia;
      type: 'cached';
    }
  | {
      download: OpenMediaDownload;
      type: 'download';
    };

async function openMediaDownload(source: string): Promise<OpenMediaDownload> {
  const response = await fetch(source, {
    cache: 'force-cache',
    credentials: 'omit'
  });

  if (!response.ok || !response.body) {
    throw new Error(`Reveal media download failed: ${response.status}`);
  }

  const expectedSize = Number(response.headers.get('content-length'));

  if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0) {
    throw new Error('Reveal media is missing a valid content length.');
  }

  return {
    body: response.body,
    contentType: response.headers.get('content-type') || 'video/mp4',
    expectedSize
  };
}

async function readMediaBlob(
  productId: MerchProductId,
  direction: RevealDirection,
  source: OpenMediaSource,
  onProgress: (loadedBytes: number, totalBytes: number) => void
) {
  if (source.type === 'cached') {
    onProgress(
      source.cached.expectedSize,
      source.cached.expectedSize
    );
    return source.cached.blob;
  }

  const blob = await downloadMedia(source.download, onProgress);

  await saveCachedRevealMedia(productId, direction, {
    blob,
    contentType: source.download.contentType,
    expectedSize: source.download.expectedSize
  });

  return blob;
}

async function downloadMedia(
  download: OpenMediaDownload,
  onProgress: (loadedBytes: number, totalBytes: number) => void
) {
  const { body, contentType, expectedSize } = download;
  const reader = body.getReader();
  const chunks: BlobPart[] = [];
  let loadedBytes = 0;

  onProgress(0, expectedSize);

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    const chunk = new Uint8Array(value.byteLength);
    chunk.set(value);
    chunks.push(chunk);
    loadedBytes += value.byteLength;
    onProgress(Math.min(loadedBytes, expectedSize), expectedSize);
  }

  if (loadedBytes !== expectedSize) {
    throw new Error(
      `Reveal media download was incomplete: ${loadedBytes}/${expectedSize}`
    );
  }

  return new Blob(chunks, {
    type: contentType
  });
}

async function warmRevealVideo(source: string) {
  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', {
    alpha: false,
    willReadFrequently: false
  });

  if (!context) {
    throw new Error('Reveal media rendering context is unavailable.');
  }

  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.style.position = 'fixed';
  video.style.inset = '0 auto auto 0';
  video.style.width = '2px';
  video.style.height = '2px';
  video.style.opacity = '0.01';
  video.style.pointerEvents = 'none';
  video.style.zIndex = '-1';
  video.src = source;
  canvas.width = 2;
  canvas.height = 2;
  document.body.appendChild(video);

  try {
    video.load();
    await waitForReadyFrame(video);

    for (const checkpoint of VIDEO_WARMUP_CHECKPOINTS) {
      await seekAndRender(
        video,
        Math.max(0, video.duration * checkpoint),
        context
      );
    }

    await seekAndRender(video, 0, context);
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
  }
}

function waitForReadyFrame(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return waitForMediaEvent(video, 'loadeddata');
}

async function seekAndRender(
  video: HTMLVideoElement,
  time: number,
  context: CanvasRenderingContext2D
) {
  if (Math.abs(video.currentTime - time) > 0.01) {
    const seeked = waitForMediaEvent(video, 'seeked');
    video.currentTime = time;
    await seeked;
  }

  try {
    context.drawImage(video, 0, 0, 2, 2);
  } catch {
    throw new RevealMediaDecodeError(
      'Reveal media frame could not be rendered.'
    );
  }
}

function waitForMediaEvent(
  video: HTMLVideoElement,
  eventName: 'loadeddata' | 'seeked'
) {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      rejectPromise(
        new RevealMediaDecodeError(
          `Reveal media did not emit ${eventName}.`
        )
      );
    }, MEDIA_EVENT_TIMEOUT_MS);

    function handleEvent() {
      cleanup();
      resolvePromise();
    }

    function handleError() {
      cleanup();
      rejectPromise(
        new RevealMediaDecodeError('Reveal media could not be decoded.')
      );
    }

    function cleanup() {
      window.clearTimeout(timeoutId);
      video.removeEventListener(eventName, handleEvent);
      video.removeEventListener('error', handleError);
    }

    video.addEventListener(eventName, handleEvent, { once: true });
    video.addEventListener('error', handleError, { once: true });
  });
}

function createReleaseHandler(urls: readonly string[]) {
  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    urls.forEach((url) => URL.revokeObjectURL(url));
  };
}
