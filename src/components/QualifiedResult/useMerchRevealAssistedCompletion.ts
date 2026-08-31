import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useLayoutEffect
} from 'react';
import type { MerchProductId } from '../../lib/merchProducts';

export type MerchRevealPhase = 'idle' | 'playing' | 'review' | 'closing';

type MerchRevealAssistedCompletionOptions = {
  forwardVideoRef: RefObject<HTMLVideoElement | null>;
  hasReverseVideo: boolean;
  journeyRef: RefObject<HTMLElement | null>;
  playbackErrors: {
    closing: string;
    decode: string;
    reveal: string;
  };
  productId: MerchProductId;
  reverseVideoRef: RefObject<HTMLVideoElement | null>;
  setMediaReady: Dispatch<SetStateAction<boolean>>;
  setPlaybackError: Dispatch<SetStateAction<string | null>>;
  setRevealPhase: Dispatch<SetStateAction<MerchRevealPhase>>;
  setShowClaimForm: Dispatch<SetStateAction<boolean>>;
  startAtEnd: boolean;
};

const AUTO_COMPLETE_SECONDS = 2.45;
const END_FRAME_PADDING_SECONDS = 0.02;
const PLAYBACK_TIMEOUT_BUFFER_MS = 1200;
const SCROLL_TRIGGER_PX = 36;
const CLAIM_FORM_PROGRESS = 0.9;
const MEDIA_EVENT_TIMEOUT_MS = 1800;
const MOBILE_REVEAL_MEDIA_QUERY = '(max-width: 860px), (pointer: coarse)';
const MOBILE_CLAIM_FORM_REVEAL_DELAY_MS = 1300;

export function useMerchRevealAssistedCompletion({
  forwardVideoRef,
  hasReverseVideo,
  journeyRef,
  playbackErrors,
  productId,
  reverseVideoRef,
  setMediaReady,
  setPlaybackError,
  setRevealPhase,
  setShowClaimForm,
  startAtEnd
}: MerchRevealAssistedCompletionOptions) {
  useLayoutEffect(() => {
    const journey = journeyRef.current!;
    const forwardVideo = forwardVideoRef.current!;
    const reverseVideo = reverseVideoRef.current!;

    if (!journey || !forwardVideo || !reverseVideo) {
      return undefined;
    }

    const reducedMotionQuery = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    );
    const mobileRevealQuery = window.matchMedia?.(MOBILE_REVEAL_MEDIA_QUERY);
    let animationFrameId = 0;
    let playbackTimerId = 0;
    let claimFormRevealTimerId = 0;
    let manualReverseStartedAt = 0;
    let forwardDuration = readVideoDuration(forwardVideo);
    let reverseDuration = readVideoDuration(reverseVideo);
    let currentPhase: MerchRevealPhase = startAtEnd ? 'review' : 'idle';
    let claimFormVisible = false;
    let mediaIsReady = false;
    let initialized = false;
    let reverseRequestId = 0;
    let disposed = false;

    prepareVideo(forwardVideo);
    prepareVideo(reverseVideo);
    setMediaReady(false);
    setPlaybackError(null);

    function readGeometry() {
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight || 1;
      const journeyTop = readDocumentOffsetTop(journey);
      const travel = Math.max(1, journey.offsetHeight - viewportHeight);

      return { journeyTop, travel };
    }

    function readScrollProgress() {
      const { journeyTop, travel } = readGeometry();
      return clampProgress((window.scrollY - journeyTop) / travel);
    }

    function setClaimFormVisible(nextVisible: boolean) {
      if (claimFormVisible === nextVisible) {
        return;
      }

      claimFormVisible = nextVisible;
      setShowClaimForm(nextVisible);
    }

    function syncProgress(
      nextProgress: number,
      { allowClaimForm = true, driveDocument = true } = {}
    ) {
      const progress = clampProgress(nextProgress);
      journey.style.setProperty('--claim-progress', progress.toFixed(3));
      journey.style.setProperty(
        '--claim-mobile-video-x',
        `${readMobileVideoPanX(productId, progress).toFixed(2)}%`
      );
      setClaimFormVisible(
        allowClaimForm &&
          !mobileRevealQuery?.matches &&
          progress >= CLAIM_FORM_PROGRESS
      );

      if (driveDocument) {
        const { journeyTop, travel } = readGeometry();
        window.scrollTo({
          top: Math.round(journeyTop + travel * progress),
          behavior: 'auto'
        });
      }
    }

    function setPhase(nextPhase: MerchRevealPhase) {
      currentPhase = nextPhase;
      setRevealPhase(nextPhase);
    }

    function clearPlaybackTimer() {
      if (playbackTimerId) {
        window.clearTimeout(playbackTimerId);
        playbackTimerId = 0;
      }
    }

    function clearAnimationFrame() {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
    }

    function clearClaimFormRevealTimer() {
      if (claimFormRevealTimerId) {
        window.clearTimeout(claimFormRevealTimerId);
        claimFormRevealTimerId = 0;
      }
    }

    function scheduleClaimFormReveal() {
      clearClaimFormRevealTimer();

      if (!mobileRevealQuery?.matches) {
        setClaimFormVisible(true);
        return;
      }

      setClaimFormVisible(false);
      claimFormRevealTimerId = window.setTimeout(() => {
        claimFormRevealTimerId = 0;
        if (!disposed && currentPhase === 'review') {
          setClaimFormVisible(true);
        }
      }, MOBILE_CLAIM_FORM_REVEAL_DELAY_MS);
    }

    function armPlaybackTimer(kind: 'forward' | 'reverse') {
      clearPlaybackTimer();
      playbackTimerId = window.setTimeout(() => {
        if (
          (kind === 'forward' && currentPhase === 'playing') ||
          (kind === 'reverse' && currentPhase === 'closing')
        ) {
          failPlayback(kind);
        }
      }, AUTO_COMPLETE_SECONDS * 1000 + PLAYBACK_TIMEOUT_BUFFER_MS);
    }

    function completeReveal(delayClaimForm = true) {
      if (currentPhase === 'review') {
        return;
      }

      clearPlaybackTimer();
      clearAnimationFrame();
      forwardVideo.pause();
      seekVideo(forwardVideo, readEndTime(forwardDuration));
      if (hasReverseVideo) {
        seekVideo(reverseVideo, 0);
      }
      setPhase('review');
      syncProgress(1);
      if (delayClaimForm) {
        scheduleClaimFormReveal();
      } else {
        clearClaimFormRevealTimer();
        setClaimFormVisible(true);
      }
      setMediaReady(true);
    }

    function completeClose() {
      if (currentPhase === 'idle') {
        return;
      }

      reverseRequestId += 1;
      clearPlaybackTimer();
      clearAnimationFrame();
      clearClaimFormRevealTimer();
      forwardVideo.pause();
      reverseVideo.pause();
      manualReverseStartedAt = 0;
      seekVideo(forwardVideo, 0);
      seekVideo(reverseVideo, 0);
      syncProgress(0, { allowClaimForm: false });

      window.requestAnimationFrame(() => {
        if (!disposed) {
          setPhase('idle');
          setMediaReady(true);
        }
      });
    }

    function failPlayback(kind: 'forward' | 'reverse') {
      clearPlaybackTimer();
      clearAnimationFrame();
      clearClaimFormRevealTimer();
      forwardVideo.pause();
      reverseVideo.pause();

      if (kind === 'forward') {
        seekVideo(forwardVideo, 0);
        syncProgress(0, { allowClaimForm: false });
        setPhase('idle');
      } else {
        seekVideo(forwardVideo, readEndTime(forwardDuration));
        seekVideo(reverseVideo, 0);
        syncProgress(1);
        setPhase('review');
        scheduleClaimFormReveal();
      }

      setMediaReady(true);
      setPlaybackError(
        kind === 'forward'
          ? playbackErrors.reveal
          : playbackErrors.closing
      );
    }

    function syncForwardProgress() {
      animationFrameId = 0;
      if (disposed || currentPhase !== 'playing') {
        return;
      }

      syncProgress(
        forwardDuration > 0
          ? forwardVideo.currentTime / forwardDuration
          : 0
      );

      if (!forwardVideo.paused && !forwardVideo.ended) {
        animationFrameId = window.requestAnimationFrame(syncForwardProgress);
      }
    }

    function requestForwardProgressSync() {
      if (!animationFrameId) {
        animationFrameId = window.requestAnimationFrame(syncForwardProgress);
      }
    }

    function syncReverseProgress() {
      animationFrameId = 0;
      if (disposed || currentPhase !== 'closing') {
        return;
      }

      syncProgress(
        reverseDuration > 0
          ? 1 - reverseVideo.currentTime / reverseDuration
          : 1,
        { allowClaimForm: false }
      );

      if (!reverseVideo.paused && !reverseVideo.ended) {
        animationFrameId = window.requestAnimationFrame(syncReverseProgress);
      }
    }

    function requestReverseProgressSync() {
      if (!animationFrameId) {
        animationFrameId = window.requestAnimationFrame(syncReverseProgress);
      }
    }

    function syncManualReverse(timestamp: number) {
      animationFrameId = 0;
      if (disposed || currentPhase !== 'closing') {
        return;
      }

      if (!manualReverseStartedAt) {
        manualReverseStartedAt = timestamp;
      }

      const progress = clampProgress(
        1 -
          (timestamp - manualReverseStartedAt) /
            (AUTO_COMPLETE_SECONDS * 1000)
      );
      seekVideo(reverseVideo, readEndTime(reverseDuration) * progress);
      syncProgress(progress, { allowClaimForm: false });

      if (progress <= 0) {
        completeClose();
        return;
      }

      animationFrameId = window.requestAnimationFrame(syncManualReverse);
    }

    function startReveal() {
      if (currentPhase !== 'idle' || document.visibilityState === 'hidden') {
        return;
      }

      setPlaybackError(null);
      setMediaReady(true);
      setPhase('playing');
      clearClaimFormRevealTimer();
      setClaimFormVisible(false);

      if (reducedMotionQuery?.matches) {
        completeReveal(false);
        return;
      }

      forwardVideo.playbackRate = readPlaybackRate(forwardDuration);
      armPlaybackTimer('forward');
      void forwardVideo.play().then(requestForwardProgressSync).catch(() => {
        if (!disposed && currentPhase === 'playing') {
          failPlayback('forward');
        }
      });
    }

    function startClose() {
      if (currentPhase !== 'review' || document.visibilityState === 'hidden') {
        return;
      }

      setPlaybackError(null);
      setPhase('closing');
      clearClaimFormRevealTimer();
      setClaimFormVisible(false);
      forwardVideo.pause();
      reverseVideo.pause();

      if (reducedMotionQuery?.matches) {
        completeClose();
        return;
      }

      if (!hasReverseVideo) {
        reverseDuration = readVideoDuration(reverseVideo) || forwardDuration;
        seekVideo(reverseVideo, readEndTime(reverseDuration));
        manualReverseStartedAt = 0;
        armPlaybackTimer('reverse');
        animationFrameId = window.requestAnimationFrame(syncManualReverse);
        return;
      }

      reverseRequestId += 1;
      const requestId = reverseRequestId;
      armPlaybackTimer('reverse');
      void seekVideoToStart(reverseVideo)
        .then(() => {
          if (
            disposed ||
            requestId !== reverseRequestId ||
            currentPhase !== 'closing'
          ) {
            return;
          }

          reverseDuration = readVideoDuration(reverseVideo);
          reverseVideo.playbackRate = readPlaybackRate(reverseDuration);
          return reverseVideo.play().then(requestReverseProgressSync);
        })
        .catch(() => {
          if (
            !disposed &&
            requestId === reverseRequestId &&
            currentPhase === 'closing'
          ) {
            failPlayback('reverse');
          }
        });
    }

    function handleScroll() {
      if (!initialized) {
        return;
      }

      const progress = readScrollProgress();
      const { travel } = readGeometry();
      if (
        currentPhase === 'idle' &&
        progress * travel >= SCROLL_TRIGGER_PX
      ) {
        startReveal();
      } else if (
        currentPhase === 'review' &&
        (1 - progress) * travel >= SCROLL_TRIGGER_PX
      ) {
        startClose();
      }
    }

    function handleMetadata() {
      forwardDuration = readVideoDuration(forwardVideo) || forwardDuration;
      reverseDuration = readVideoDuration(reverseVideo) || reverseDuration;
      forwardVideo.playbackRate = readPlaybackRate(forwardDuration);
      reverseVideo.playbackRate = readPlaybackRate(reverseDuration);

      if (!initialized && forwardDuration > 0) {
        initialized = true;
        if (startAtEnd) {
          seekVideo(forwardVideo, readEndTime(forwardDuration));
          setPhase('review');
          syncProgress(1);
          clearClaimFormRevealTimer();
          setClaimFormVisible(true);
        } else {
          seekVideo(forwardVideo, 0);
          seekVideo(reverseVideo, 0);
          setPhase('idle');
          syncProgress(0, { allowClaimForm: false });
        }
      }

      markMediaReady();
    }

    function markMediaReady() {
      const ready =
        forwardVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        reverseVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

      if (ready && !mediaIsReady) {
        mediaIsReady = true;
        setMediaReady(true);
      }
    }

    function handleForwardEnded() {
      if (currentPhase === 'playing') {
        completeReveal();
      }
    }

    function handleReverseEnded() {
      if (currentPhase === 'closing') {
        completeClose();
      }
    }

    function handleMediaError() {
      if (currentPhase === 'closing') {
        failPlayback('reverse');
      } else if (currentPhase === 'playing') {
        failPlayback('forward');
      } else {
        setPlaybackError(playbackErrors.decode);
      }
    }

    function handleReducedMotionChange() {
      if (!reducedMotionQuery?.matches) {
        return;
      }

      if (currentPhase === 'playing') {
        completeReveal(false);
      } else if (currentPhase === 'closing') {
        completeClose();
      }
    }

    const readinessEvents = ['loadeddata', 'canplay', 'seeked'] as const;
    forwardVideo.addEventListener('loadedmetadata', handleMetadata);
    reverseVideo.addEventListener('loadedmetadata', handleMetadata);
    for (const eventName of readinessEvents) {
      forwardVideo.addEventListener(eventName, markMediaReady);
      reverseVideo.addEventListener(eventName, markMediaReady);
    }
    forwardVideo.addEventListener('timeupdate', requestForwardProgressSync);
    forwardVideo.addEventListener('ended', handleForwardEnded);
    if (hasReverseVideo) {
      reverseVideo.addEventListener('timeupdate', requestReverseProgressSync);
      reverseVideo.addEventListener('ended', handleReverseEnded);
    }
    forwardVideo.addEventListener('error', handleMediaError);
    reverseVideo.addEventListener('error', handleMediaError);
    window.addEventListener('scroll', handleScroll, { passive: true });
    reducedMotionQuery?.addEventListener('change', handleReducedMotionChange);

    if (forwardVideo.readyState >= HTMLMediaElement.HAVE_METADATA) {
      handleMetadata();
    }
    if (reverseVideo.readyState >= HTMLMediaElement.HAVE_METADATA) {
      handleMetadata();
    }
    markMediaReady();

    return () => {
      disposed = true;
      reverseRequestId += 1;
      clearPlaybackTimer();
      clearAnimationFrame();
      clearClaimFormRevealTimer();
      forwardVideo.pause();
      reverseVideo.pause();
      forwardVideo.removeEventListener('loadedmetadata', handleMetadata);
      reverseVideo.removeEventListener('loadedmetadata', handleMetadata);
      for (const eventName of readinessEvents) {
        forwardVideo.removeEventListener(eventName, markMediaReady);
        reverseVideo.removeEventListener(eventName, markMediaReady);
      }
      forwardVideo.removeEventListener('timeupdate', requestForwardProgressSync);
      forwardVideo.removeEventListener('ended', handleForwardEnded);
      if (hasReverseVideo) {
        reverseVideo.removeEventListener(
          'timeupdate',
          requestReverseProgressSync
        );
        reverseVideo.removeEventListener('ended', handleReverseEnded);
      }
      forwardVideo.removeEventListener('error', handleMediaError);
      reverseVideo.removeEventListener('error', handleMediaError);
      window.removeEventListener('scroll', handleScroll);
      reducedMotionQuery?.removeEventListener(
        'change',
        handleReducedMotionChange
      );
    };
  }, [
    forwardVideoRef,
    hasReverseVideo,
    journeyRef,
    playbackErrors,
    productId,
    reverseVideoRef,
    setMediaReady,
    setPlaybackError,
    setRevealPhase,
    setShowClaimForm,
    startAtEnd
  ]);
}

function prepareVideo(video: HTMLVideoElement) {
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.pause();
}

function seekVideo(video: HTMLVideoElement, targetTime: number) {
  if (
    video.readyState < HTMLMediaElement.HAVE_METADATA ||
    !Number.isFinite(targetTime)
  ) {
    return;
  }

  try {
    video.currentTime = targetTime;
  } catch {
    // Metadata and seek ranges can settle one task after loadedmetadata.
  }
}

async function seekVideoToStart(video: HTMLVideoElement) {
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
    await waitForVideoEvent(video, 'loadedmetadata');
  }

  if (video.currentTime > 0.01) {
    const seeked = waitForVideoEvent(video, 'seeked');
    video.currentTime = 0;
    await seeked;
  }

  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await waitForVideoEvent(video, 'loadeddata');
  }
}

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: 'loadeddata' | 'loadedmetadata' | 'seeked'
) {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      rejectPromise(new Error(`Reveal media did not emit ${eventName}.`));
    }, MEDIA_EVENT_TIMEOUT_MS);

    function handleEvent() {
      cleanup();
      resolvePromise();
    }

    function handleError() {
      cleanup();
      rejectPromise(new Error('Reveal media could not be decoded.'));
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

function readPlaybackRate(duration: number) {
  return Math.min(
    3,
    Math.max(1, duration > 0 ? duration / AUTO_COMPLETE_SECONDS : 1)
  );
}

function readVideoDuration(video: HTMLVideoElement) {
  return Number.isFinite(video.duration) && video.duration > 0
    ? video.duration
    : 0;
}

function readEndTime(duration: number) {
  return Math.max(0, duration - END_FRAME_PADDING_SECONDS);
}

function clampProgress(progress: number) {
  return Math.min(
    1,
    Math.max(0, Number.isFinite(progress) ? progress : 0)
  );
}

function readMobileVideoPanX(
  productId: MerchProductId,
  progress: number
) {
  if (productId === 'ticket') {
    return interpolateCameraStops(
      [
        { progress: 0, position: 50 },
        { progress: 0.14, position: 50 },
        { progress: 0.23, position: 88 },
        { progress: 0.4, position: 88 },
        { progress: 0.46, position: 76 },
        { progress: 0.57, position: 20 },
        { progress: 0.7, position: 18 },
        { progress: 1, position: 18 }
      ],
      progress
    );
  }

  const start = 50;
  const end = 18;
  const easedProgress = 1 - Math.pow(1 - clampProgress(progress), 3);

  return start + (end - start) * easedProgress;
}

function interpolateCameraStops(
  stops: Array<{ progress: number; position: number }>,
  progress: number
) {
  const clampedProgress = clampProgress(progress);

  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1];
    const next = stops[index];

    if (clampedProgress > next.progress) {
      continue;
    }

    const segmentProgress = clampProgress(
      (clampedProgress - previous.progress) /
        Math.max(0.001, next.progress - previous.progress)
    );
    const easedProgress = smoothStep(segmentProgress);

    return (
      previous.position +
      (next.position - previous.position) * easedProgress
    );
  }

  return stops.at(-1)?.position ?? 50;
}

function smoothStep(progress: number) {
  const clampedProgress = clampProgress(progress);
  return clampedProgress * clampedProgress * (3 - 2 * clampedProgress);
}

function readDocumentOffsetTop(element: HTMLElement) {
  let offsetTop = 0;
  let currentElement: HTMLElement | null = element;

  while (currentElement) {
    offsetTop += currentElement.offsetTop;
    currentElement = currentElement.offsetParent as HTMLElement | null;
  }

  return offsetTop;
}
