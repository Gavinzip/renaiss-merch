import {
  type FormEvent,
  useEffect,
  useRef,
  useState
} from 'react';
import { type MerchEligibilityResult } from '../../lib/merchEligibility';
import {
  saveShippingClaim,
  type ShippingClaimPayload
} from '../../lib/shippingClaim';
import { shippingCountries } from '../../lib/shippingCountries';
import './QualifiedResult.css';

const MERCH_MEDIA_BASE_URL =
  'https://pub-152183cd35ab428096bc92f48b651a94.r2.dev/merch/reveal';
const revealVideoSrc = `${MERCH_MEDIA_BASE_URL}/merch-claim-reveal.mp4?v=20260627`;
const reverseRevealVideoSrc = `${MERCH_MEDIA_BASE_URL}/merch-claim-reveal-reverse.mp4?v=20260627`;
const AUTO_REVEAL_SECONDS = 2.45;
const REVEAL_WATCHDOG_BUFFER_MS = 900;
const SCROLL_TRIGGER_PX = 36;
const REVIEW_CLOSE_COOLDOWN_MS = 900;
const REVIEW_CLOSE_WHEEL_DELTA_PX = 80;
const REVIEW_CLOSE_WHEEL_WINDOW_MS = 320;
const SHIPPING_REVEAL_VIDEO_PROGRESS = 0.86;
type RevealPhase = 'idle' | 'playing' | 'review' | 'closing';
type ShippingSubmitState = 'idle' | 'saving' | 'saved' | 'error';

type QualifiedResultProps = {
  result: MerchEligibilityResult;
};

export function QualifiedResult({ result }: QualifiedResultProps) {
  const scrollerRef = useRef<HTMLElement | null>(null);
  const forwardVideoRef = useRef<HTMLVideoElement | null>(null);
  const reverseVideoRef = useRef<HTMLVideoElement | null>(null);
  const shippingVisibleRef = useRef(false);
  const [showShipping, setShowShipping] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('idle');
  const [shippingSubmitState, setShippingSubmitState] =
    useState<ShippingSubmitState>('idle');

  useEffect(() => {
    const containerElement = scrollerRef.current;
    const forwardVideoElement = forwardVideoRef.current;
    const reverseVideoElement = reverseVideoRef.current;

    if (!containerElement || !forwardVideoElement || !reverseVideoElement) {
      return undefined;
    }

    const container = containerElement;
    const video = forwardVideoElement;
    const reverseVideo = reverseVideoElement;

    const reduceMotionQuery = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    );

    if (reduceMotionQuery?.matches) {
      video.pause();
      reverseVideo.pause();
      shippingVisibleRef.current = true;
      setShowShipping(true);
      container.style.setProperty('--claim-progress', '1');
      return undefined;
    }

    let frameId = 0;
    let duration =
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 6;
    let revealPhaseRef: RevealPhase = 'idle';
    let reviewReadyAt = 0;
    let revealTimerId = 0;
    let closeTimerId = 0;
    let upwardWheelDelta = 0;
    let lastWheelAt = 0;

    function prepareVideo(targetVideo: HTMLVideoElement) {
      targetVideo.muted = true;
      targetVideo.playsInline = true;
      targetVideo.setAttribute('playsinline', '');
      targetVideo.setAttribute('webkit-playsinline', '');
    }

    function markMediaReady() {
      if (video.readyState >= 2) {
        setMediaReady(true);
      }
    }

    function syncProgress(nextProgress: number, allowShipping = true) {
      const progress = Math.min(
        1,
        Math.max(0, Number.isFinite(nextProgress) ? nextProgress : 0)
      );

      container.style.setProperty('--claim-progress', progress.toFixed(3));

      const nextShippingVisible =
        allowShipping && progress >= SHIPPING_REVEAL_VIDEO_PROGRESS;
      if (shippingVisibleRef.current !== nextShippingVisible) {
        shippingVisibleRef.current = nextShippingVisible;
        setShowShipping(nextShippingVisible);
      }
    }

    function getScrollProgress() {
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight || 1;
      const containerTop = container.getBoundingClientRect().top + window.scrollY;
      const travel = Math.max(1, container.offsetHeight - viewportHeight);
      const progress = Math.min(
        1,
        Math.max(0, (window.scrollY - containerTop) / travel)
      );

      return { containerTop, progress, travel };
    }

    function syncProgressToVideo() {
      frameId = 0;
      syncProgress(duration > 0 ? video.currentTime / duration : 0);

      if (!video.paused && !video.ended) {
        frameId = window.requestAnimationFrame(syncProgressToVideo);
      }
    }

    function syncProgressToReverseVideo() {
      frameId = 0;
      const reverseProgress =
        duration > 0 ? 1 - reverseVideo.currentTime / duration : 1;
      syncProgress(reverseProgress, false);

      if (!reverseVideo.paused && !reverseVideo.ended) {
        frameId = window.requestAnimationFrame(syncProgressToReverseVideo);
      }
    }

    function requestProgressSync() {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(syncProgressToVideo);
    }

    function requestReverseProgressSync() {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(syncProgressToReverseVideo);
    }

    function completeReveal() {
      if (revealPhaseRef === 'review') {
        return;
      }

      clearRevealTimer();
      revealPhaseRef = 'review';
      setRevealPhase('review');
      video.pause();
      video.currentTime = Math.max(0, duration - 0.02);
      shippingVisibleRef.current = true;
      setShowShipping(true);
      syncProgress(1);
      reviewReadyAt = performance.now();
      upwardWheelDelta = 0;

      const { containerTop, travel } = getScrollProgress();
      window.scrollTo({
        top: Math.round(containerTop + travel),
        behavior: 'auto'
      });
    }

    function completeClose() {
      if (revealPhaseRef === 'idle') {
        return;
      }

      clearCloseTimer();
      revealPhaseRef = 'idle';
      reverseVideo.pause();
      video.pause();
      video.currentTime = 0;
      video.playbackRate = Math.min(
        3,
        Math.max(1, duration / AUTO_REVEAL_SECONDS)
      );
      shippingVisibleRef.current = false;
      setShowShipping(false);
      syncProgress(0);

      const { containerTop } = getScrollProgress();
      window.scrollTo({
        top: Math.round(containerTop),
        behavior: 'auto'
      });

      window.requestAnimationFrame(() => {
        setRevealPhase('idle');
      });
    }

    function startReveal() {
      if (revealPhaseRef !== 'idle' || document.visibilityState === 'hidden') {
        return;
      }

      revealPhaseRef = 'playing';
      setRevealPhase('playing');
      video.playbackRate = Math.min(
        3,
        Math.max(1, duration / AUTO_REVEAL_SECONDS)
      );
      clearRevealTimer();
      revealTimerId = window.setTimeout(
        completeReveal,
        AUTO_REVEAL_SECONDS * 1000 + REVEAL_WATCHDOG_BUFFER_MS
      );

      void video.play().then(requestProgressSync).catch(() => undefined);
    }

    function startClose() {
      if (revealPhaseRef !== 'review' || document.visibilityState === 'hidden') {
        return;
      }

      revealPhaseRef = 'closing';
      shippingVisibleRef.current = false;
      setShowShipping(false);
      video.pause();
      video.currentTime = 0;
      reverseVideo.pause();
      reverseVideo.currentTime = 0;
      reverseVideo.playbackRate = Math.min(
        3,
        Math.max(1, duration / AUTO_REVEAL_SECONDS)
      );
      setRevealPhase('closing');
      clearCloseTimer();
      closeTimerId = window.setTimeout(
        completeClose,
        AUTO_REVEAL_SECONDS * 1000 + REVEAL_WATCHDOG_BUFFER_MS
      );

      void reverseVideo
        .play()
        .then(requestReverseProgressSync)
        .catch(() => undefined);
    }

    function handleScroll() {
      if (revealPhaseRef === 'review') {
        return;
      }

      if (revealPhaseRef !== 'idle') {
        return;
      }

      const { containerTop } = getScrollProgress();
      const scrollDelta = window.scrollY - containerTop;

      if (scrollDelta >= SCROLL_TRIGGER_PX) {
        startReveal();
      }
    }

    function handleWheel(event: WheelEvent) {
      if (revealPhaseRef !== 'review' || event.deltaY >= 0) {
        return;
      }

      if (performance.now() - reviewReadyAt < REVIEW_CLOSE_COOLDOWN_MS) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const shippingPanel = target?.closest('.qualified-result__shipping');
      if (
        shippingPanel instanceof HTMLElement &&
        shippingPanel.scrollTop > 0
      ) {
        return;
      }

      const now = performance.now();
      upwardWheelDelta =
        now - lastWheelAt > REVIEW_CLOSE_WHEEL_WINDOW_MS
          ? Math.abs(event.deltaY)
          : upwardWheelDelta + Math.abs(event.deltaY);
      lastWheelAt = now;

      if (upwardWheelDelta < REVIEW_CLOSE_WHEEL_DELTA_PX) {
        return;
      }

      event.preventDefault();
      startClose();
    }

    function handleMetadata() {
      duration =
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : duration;
      video.pause();
      video.currentTime = 0;
      video.playbackRate = Math.min(
        3,
        Math.max(1, duration / AUTO_REVEAL_SECONDS)
      );
      reverseVideo.playbackRate = video.playbackRate;
      syncProgress(0);
    }

    function handleEnded() {
      completeReveal();
    }

    function handleReverseEnded() {
      completeClose();
    }

    function clearRevealTimer() {
      if (revealTimerId) {
        window.clearTimeout(revealTimerId);
        revealTimerId = 0;
      }
    }

    function clearCloseTimer() {
      if (closeTimerId) {
        window.clearTimeout(closeTimerId);
        closeTimerId = 0;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden' && revealPhaseRef === 'playing') {
        video.pause();
      }

      if (document.visibilityState === 'hidden' && revealPhaseRef === 'closing') {
        reverseVideo.pause();
      }
    }

    prepareVideo(video);
    prepareVideo(reverseVideo);
    video.pause();
    reverseVideo.pause();
    video.addEventListener('loadedmetadata', handleMetadata);
    video.addEventListener('loadeddata', markMediaReady);
    video.addEventListener('canplay', markMediaReady);
    video.addEventListener('timeupdate', requestProgressSync);
    video.addEventListener('ended', handleEnded);
    reverseVideo.addEventListener('timeupdate', requestReverseProgressSync);
    reverseVideo.addEventListener('ended', handleReverseEnded);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('visibilitychange', handleVisibilityChange);

    if (video.readyState >= 1) {
      handleMetadata();
    }

    if (video.readyState >= 2) {
      markMediaReady();
    }

    syncProgress(0);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      clearRevealTimer();
      clearCloseTimer();
      video.removeEventListener('loadedmetadata', handleMetadata);
      video.removeEventListener('loadeddata', markMediaReady);
      video.removeEventListener('canplay', markMediaReady);
      video.removeEventListener('timeupdate', requestProgressSync);
      video.removeEventListener('ended', handleEnded);
      reverseVideo.removeEventListener('timeupdate', requestReverseProgressSync);
      reverseVideo.removeEventListener('ended', handleReverseEnded);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  async function handleShippingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (shippingSubmitState === 'saving') {
      return;
    }

    setShippingSubmitState('saving');

    try {
      await saveShippingClaim(readShippingClaimPayload(event.currentTarget));
      setShippingSubmitState('saved');
    } catch {
      setShippingSubmitState('error');
    }
  }

  return (
    <section
      className={`qualified-result ${
        showShipping ? 'qualified-result--shipping' : ''
      } qualified-result--${revealPhase} ${
        mediaReady ? 'qualified-result--ready' : 'qualified-result--loading'
      }`}
      aria-labelledby="qualified-title"
      aria-live="polite"
      ref={scrollerRef}
    >
      <div className="qualified-result__scroll">
        <div className="qualified-result__stage">
          <video
            ref={forwardVideoRef}
            className="qualified-result__video qualified-result__video--forward"
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            src={revealVideoSrc}
          />
          <video
            ref={reverseVideoRef}
            className="qualified-result__video qualified-result__video--reverse"
            muted
            playsInline
            preload="metadata"
            disablePictureInPicture
            src={reverseRevealVideoSrc}
            aria-hidden="true"
          />

          <div className="qualified-result__veil" aria-hidden="true" />

          <div
            className="qualified-result__scroll-hint"
            aria-hidden={revealPhase !== 'idle'}
          >
            <span />
          </div>

          <div className="qualified-result__status" aria-hidden={showShipping}>
            <p className="qualified-result__eyebrow">RENAISS MERCH</p>
            <h2 id="qualified-title">Qualified</h2>
            <p>
              {result.sbtBalance} SBT verified.
            </p>
          </div>

          <form
            className="qualified-result__shipping"
            onSubmit={handleShippingSubmit}
            aria-label="Shipping address"
          >
            <p className="qualified-result__eyebrow">Claim details</p>
            <h2>Shipping address</h2>
            <p>
              {result.sbtBalance} SBT verified. Add the recipient details for
              this merch claim.
            </p>

            <div className="qualified-result__fields">
              <label className="qualified-result__field-half">
                First name
                <input
                  autoComplete="shipping given-name"
                  name="firstName"
                  placeholder="First name"
                  required
                  type="text"
                />
              </label>
              <label className="qualified-result__field-half">
                Last name
                <input
                  autoComplete="shipping family-name"
                  name="lastName"
                  placeholder="Last name"
                  required
                  type="text"
                />
              </label>
              <label className="qualified-result__field-half">
                Email
                <input
                  autoComplete="email"
                  name="email"
                  placeholder="name@example.com"
                  required
                  type="email"
                />
              </label>
              <label className="qualified-result__field-half">
                Phone
                <input
                  autoComplete="shipping tel"
                  name="phone"
                  placeholder="+1 555 000 0000"
                  required
                  type="tel"
                />
              </label>
              <label className="qualified-result__field-wide">
                Country / region
                <select
                  autoComplete="shipping country-name"
                  name="country"
                  required
                  defaultValue="US"
                >
                  {shippingCountries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="qualified-result__field-wide">
                Address line 1
                <input
                  autoComplete="shipping address-line1"
                  name="addressLine1"
                  placeholder="Street address or PO box"
                  required
                  type="text"
                />
              </label>
              <label className="qualified-result__field-wide">
                Address line 2
                <input
                  autoComplete="shipping address-line2"
                  name="addressLine2"
                  placeholder="Apartment, suite, unit, building (optional)"
                  type="text"
                />
              </label>
              <label className="qualified-result__field-third">
                City
                <input
                  autoComplete="shipping address-level2"
                  name="city"
                  placeholder="City"
                  required
                  type="text"
                />
              </label>
              <label className="qualified-result__field-third">
                State / province
                <input
                  autoComplete="shipping address-level1"
                  name="region"
                  placeholder="State"
                  required
                  type="text"
                />
              </label>
              <label className="qualified-result__field-third">
                ZIP / postal code
                <input
                  autoComplete="shipping postal-code"
                  name="postalCode"
                  placeholder="Postal code"
                  required
                  type="text"
                />
              </label>
              <label className="qualified-result__field-wide">
                Delivery notes
                <textarea
                  name="deliveryNotes"
                  placeholder="Gate code, preferred delivery detail, or local instructions (optional)"
                  rows={3}
                />
              </label>
            </div>

            <div className="qualified-result__actions">
              <button
                type="submit"
                disabled={shippingSubmitState === 'saving'}
              >
                {shippingSubmitState === 'saving'
                  ? 'Saving'
                  : 'Save shipping details'}
              </button>
              <a
                className="qualified-result__reset-link"
                href="/api/auth/logout-return?returnTo=/"
              >
                Check another wallet
              </a>
            </div>
            <p
              className={`qualified-result__submit-status qualified-result__submit-status--${shippingSubmitState}`}
              role="status"
            >
              {readShippingSubmitStatus(shippingSubmitState)}
            </p>
          </form>

          <div className="qualified-result__loader" aria-hidden={mediaReady}>
            <span />
          </div>
        </div>
      </div>
    </section>
  );
}

function readShippingClaimPayload(form: HTMLFormElement): ShippingClaimPayload {
  const formData = new FormData(form);

  return {
    addressLine1: readFormValue(formData, 'addressLine1'),
    addressLine2: readFormValue(formData, 'addressLine2'),
    city: readFormValue(formData, 'city'),
    country: readFormValue(formData, 'country'),
    deliveryNotes: readFormValue(formData, 'deliveryNotes'),
    email: readFormValue(formData, 'email'),
    firstName: readFormValue(formData, 'firstName'),
    lastName: readFormValue(formData, 'lastName'),
    phone: readFormValue(formData, 'phone'),
    postalCode: readFormValue(formData, 'postalCode'),
    region: readFormValue(formData, 'region')
  };
}

function readFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === 'string' ? value.trim() : '';
}

function readShippingSubmitStatus(state: ShippingSubmitState) {
  switch (state) {
    case 'saving':
      return 'Saving shipping details.';
    case 'saved':
      return 'Shipping details saved.';
    case 'error':
      return 'Could not save shipping details.';
    default:
      return '';
  }
}
