import type { MerchProductId } from './merchProducts';

const REVEAL_DIRECTIONS = ['forward', 'reverse'] as const;
const DOWNLOAD_PROGRESS_MAX = 88;
const VIDEO_WARMUP_CHECKPOINTS = [0, 0.2, 0.4, 0.6, 0.8, 0.995] as const;

type RevealDirection = (typeof REVEAL_DIRECTIONS)[number];

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

export class RevealMediaAccessError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Reveal media access is unavailable: ${status}`);
    this.name = 'RevealMediaAccessError';
    this.status = status;
  }
}

export async function prepareRevealMedia(
  productId: MerchProductId,
  onProgress: (progress: RevealMediaAdmissionProgress) => void
): Promise<PreparedRevealMedia> {
  const sources = Object.fromEntries(
    REVEAL_DIRECTIONS.map((direction) => [
      direction,
      readRevealMediaUrl(productId, direction)
    ])
  ) as Record<RevealDirection, string>;
  const sizes = Object.fromEntries(
    await Promise.all(
      REVEAL_DIRECTIONS.map(async (direction) => [
        direction,
        await readMediaSize(sources[direction])
      ])
    )
  ) as Record<RevealDirection, number>;
  const loadedBytes: Record<RevealDirection, number> = {
    forward: 0,
    reverse: 0
  };
  const totalBytes = sizes.forward + sizes.reverse;

  onProgress({
    loadedBytes: 0,
    percent: 1,
    stage: 'download',
    totalBytes
  });

  const blobs = Object.fromEntries(
    await Promise.all(
      REVEAL_DIRECTIONS.map(async (direction) => [
        direction,
        await downloadMedia(
          sources[direction],
          sizes[direction],
          (loaded) => {
            loadedBytes[direction] = loaded;
            onProgress({
              loadedBytes: loadedBytes.forward + loadedBytes.reverse,
              percent: Math.min(
                DOWNLOAD_PROGRESS_MAX,
                Math.max(
                  1,
                  Math.round(
                    ((loadedBytes.forward + loadedBytes.reverse) / totalBytes) *
                      DOWNLOAD_PROGRESS_MAX
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
    await Promise.all([
      warmRevealVideo(forwardUrl),
      warmRevealVideo(reverseUrl)
    ]);
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

async function readMediaSize(source: string) {
  const response = await fetch(source, {
    cache: 'no-store',
    credentials: 'same-origin',
    method: 'HEAD'
  });

  if (!response.ok) {
    if (isAccessResponse(response.status)) {
      throw new RevealMediaAccessError(response.status);
    }

    throw new Error(`Reveal media metadata request failed: ${response.status}`);
  }

  const contentLength = Number(response.headers.get('content-length'));

  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    throw new Error('Reveal media is missing a valid content length.');
  }

  return contentLength;
}

async function downloadMedia(
  source: string,
  expectedSize: number,
  onProgress: (loadedBytes: number) => void
) {
  const response = await fetch(source, {
    cache: 'no-store',
    credentials: 'same-origin'
  });

  if (!response.ok || !response.body) {
    if (isAccessResponse(response.status)) {
      throw new RevealMediaAccessError(response.status);
    }

    throw new Error(`Reveal media download failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let loadedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    const chunk = new Uint8Array(value.byteLength);
    chunk.set(value);
    chunks.push(chunk);
    loadedBytes += value.byteLength;
    onProgress(Math.min(loadedBytes, expectedSize));
  }

  if (loadedBytes !== expectedSize) {
    throw new Error(
      `Reveal media download was incomplete: ${loadedBytes}/${expectedSize}`
    );
  }

  return new Blob(chunks, {
    type: response.headers.get('content-type') || 'video/mp4'
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

  context.drawImage(video, 0, 0, 2, 2);
}

function waitForMediaEvent(
  video: HTMLVideoElement,
  eventName: 'loadeddata' | 'seeked'
) {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    function handleEvent() {
      cleanup();
      resolvePromise();
    }

    function handleError() {
      cleanup();
      rejectPromise(new Error('Reveal media could not be decoded.'));
    }

    function cleanup() {
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

function readRevealMediaUrl(
  productId: MerchProductId,
  direction: RevealDirection
) {
  const parameters = new URLSearchParams({ direction, productId });
  return `/api/merch-reveal-media?${parameters.toString()}`;
}

function isAccessResponse(status: number) {
  return status === 401 || status === 403 || status === 409;
}
