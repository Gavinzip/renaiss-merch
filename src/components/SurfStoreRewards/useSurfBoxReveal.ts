import { useEffect, useRef, useState } from 'react';
import { readSurfRevealMedia } from '../../lib/surfRevealAssets';
import { presentSurfVideoFrame } from './presentSurfVideoFrame';
import {
  type MerchRevealPhase,
  useMerchRevealAssistedCompletion
} from '../QualifiedResult/useMerchRevealAssistedCompletion';

type AdmissionStage = 'download' | 'decode' | 'render';
const TIMEOUT_MS = 30_000;

// Media preparation and scroll playback have distinct ownership. Reuse the
// exact native-document assisted-completion driver used by the three products.
export function useSurfBoxReveal(playbackErrors: { closing: string; decode: string; reveal: string }) {
  const forwardVideoRef = useRef<HTMLVideoElement>(null);
  const reverseVideoRef = useRef<HTMLVideoElement>(null);
  const journeyRef = useRef<HTMLElement>(null);
  const [admitted, setAdmitted] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, stage: 'download' as AdmissionStage });
  const [revision, setRevision] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [phase, setPhase] = useState<MerchRevealPhase>('idle');
  const [showForm, setShowForm] = useState(false);
  const [posterUrl, setPosterUrl] = useState('');
  const [, setMediaReady] = useState(false);

  useMerchRevealAssistedCompletion({
    enabled: admitted,
    autoCompleteSeconds: 2.45,
    claimFormProgress: 1,
    forwardVideoRef,
    reverseVideoRef,
    journeyRef,
    hasReverseVideo: true,
    productId: 'surf-box',
    playbackErrors,
    setMediaReady,
    setPlaybackError,
    setRevealPhase: setPhase,
    setShowClaimForm: setShowForm,
    startAtEnd: false
  });

  useEffect(() => {
    const videos = [forwardVideoRef.current, reverseVideoRef.current];
    if (!videos[0] || !videos[1]) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(TIMEOUT_MS)]);
    const objectUrls: string[] = [];
    setAdmitted(false);
    setLoadError(false);
    setPlaybackError(null);
    setPhase('idle');
    setShowForm(false);
    setProgress({ percent: 0, stage: 'download' });

    async function prepare() {
      const mediaUrls = await readSurfRevealMedia(signal);
      const poster = new Image();
      const posterReady = (async () => {
        const response = await fetch(mediaUrls.poster, { signal, credentials: 'omit', cache: 'no-store' });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('surf_poster_invalid');
        const blob = await response.blob();
        signal.throwIfAborted();
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        poster.src = url;
        await waitForCompletion(poster.decode(), signal);
        signal.throwIfAborted();
        setPosterUrl(url);
      })();
      void posterReady.catch(() => undefined);
      const responses = await Promise.all(['video', 'reverse'].map(asset =>
        fetch(mediaUrls[asset as 'video' | 'reverse'], { signal, credentials: 'omit', cache: 'no-store' })
      ));
      const sizes = responses.map(response => {
        const size = Number(response.headers.get('content-length'));
        if (!response.ok || !response.body || !response.headers.get('content-type')?.startsWith('video/') || !Number.isSafeInteger(size) || size <= 0) {
          throw new Error('surf_reveal_download_invalid');
        }
        return size;
      });
      const totalBytes = sizes.reduce((sum, size) => sum + size, 0);
      let downloadedBytes = 0;
      const blobs = await Promise.all(responses.map(async (response, index) => {
        const chunks: BlobPart[] = [];
        const reader = response.body!.getReader();
        let fileBytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(new Uint8Array(value));
          fileBytes += value.byteLength;
          downloadedBytes += value.byteLength;
          if (!signal.aborted) setProgress({ percent: Math.min(88, Math.floor(downloadedBytes / totalBytes * 88)), stage: 'download' });
        }
        if (fileBytes !== sizes[index]) throw new Error('surf_reveal_download_incomplete');
        return new Blob(chunks, { type: 'video/mp4' });
      }));
      await posterReady;
      signal.throwIfAborted();
      setProgress({ percent: 90, stage: 'decode' });
      // Warm both complete decoders and both endpoints before admitting scroll.
      await Promise.all(videos.map(async (video, index) => {
        const media = video!;
        const objectUrl = URL.createObjectURL(blobs[index]);
        objectUrls.push(objectUrl);
        const loaded = waitForMediaEvent(media, 'loadeddata', signal);
        media.src = objectUrl;
        media.load();
        await loaded;
        if (!Number.isFinite(media.duration) || media.duration <= 0 || media.videoWidth !== 1920 || media.videoHeight !== 1080) {
          throw new Error('surf_reveal_source_invalid');
        }
        await presentSurfVideoFrame(media, Math.max(0, media.duration - 1 / 24), signal);
        await presentSurfVideoFrame(media, 0, signal);
      }));
      setProgress({ percent: 99, stage: 'render' });
      await nextPaint();
      signal.throwIfAborted();
      setProgress({ percent: 100, stage: 'render' });
      // Ready means a closed box waiting for a directional scroll, not autoplay.
      setAdmitted(true);
    }
    void prepare().catch(error => {
      if (!controller.signal.aborted) {
        console.error('[Surf box preparation]', error instanceof Error ? error.message : 'unknown_preparation_error');
        setLoadError(true);
        controller.abort();
      }
    });
    return () => {
      controller.abort();
      for (const video of videos) {
        video!.pause();
        video!.removeAttribute('src');
        video!.load();
      }
      objectUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [revision]);

  return {
    forwardVideoRef, reverseVideoRef, journeyRef, phase, progress,
    admitted, loadError, playbackError, showForm, posterUrl,
    retry: () => { setAdmitted(false); setRevision(value => value + 1); }
  };
}

function waitForMediaEvent(video: HTMLVideoElement, event: 'loadeddata', signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(fail, TIMEOUT_MS);
    function cleanup() {
      clearTimeout(timer);
      video.removeEventListener(event, done);
      video.removeEventListener('error', fail);
      signal.removeEventListener('abort', fail);
    }
    function done() { cleanup(); resolve(); }
    function fail() { cleanup(); reject(new Error('surf_reveal_frame_unavailable')); }
    video.addEventListener(event, done, { once: true });
    video.addEventListener('error', fail, { once: true });
    signal.addEventListener('abort', fail, { once: true });
    if (signal.aborted) fail();
  });
}

function nextPaint() {
  return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function waitForCompletion(promise: Promise<void>, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    function aborted() { reject(new Error('surf_reveal_preparation_cancelled')); }
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted();
    promise.then(() => { signal.removeEventListener('abort', aborted); resolve(); }, error => {
      signal.removeEventListener('abort', aborted); reject(error);
    });
  });
}
