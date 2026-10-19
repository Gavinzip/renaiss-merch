import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { MerchRevealPhase } from '../QualifiedResult/useMerchRevealAssistedCompletion';

// Native page scroll expresses direction; one bounded animation completes it.
// The card is vector artwork, so no video decoder or media-time seeking exists.
export function useSurfProMotion(enabled: boolean, onProgress: (progress: number) => void) {
  const journeyRef = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<MerchRevealPhase>('idle');
  const [showForm, setShowForm] = useState(false);
  const [frontVisible, setFrontVisible] = useState(false);
  const accountHiddenRef = useRef<(() => void) | null>(null);
  const onAccountHidden = useCallback(() => accountHiddenRef.current?.(), []);

  useLayoutEffect(() => {
    const journey = journeyRef.current;
    if (!enabled || !journey) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const durationMs = Number.parseFloat(getComputedStyle(journey).getPropertyValue('--surf-pro-motion-ms'));
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;
    let currentPhase: MerchRevealPhase = 'idle';
    let progress = 0;
    let frame = 0;
    let disposed = false;
    let formShown = false;
    let showingFront = false;
    let awaitingAccountExit = false;
    let accountExitComplete = false;

    function geometry() {
      return {
        top: journey!.getBoundingClientRect().top + window.scrollY,
        travel: Math.max(1, journey!.offsetHeight - window.innerHeight)
      };
    }
    function showAccount(show: boolean) {
      if (formShown !== show) { formShown = show; setShowForm(show); }
    }
    function sync(value: number) {
      progress = value;
      journey!.style.setProperty('--surf-pro-progress', value.toFixed(4));
      const nextFront = value >= .5;
      if (nextFront !== showingFront) { showingFront = nextFront; setFrontVisible(nextFront); }
      onProgress(value);
      const { top, travel } = geometry();
      window.scrollTo({ top: Math.round(top + travel * value), behavior: 'instant' });
    }
    function finish(open: boolean) {
      awaitingAccountExit = false;
      accountExitComplete = false;
      sync(open ? 1 : 0);
      currentPhase = open ? 'review' : 'idle';
      setPhase(currentPhase);
      showAccount(open);
    }
    function animate(open: boolean) {
      if (frame || document.visibilityState === 'hidden') return;
      currentPhase = open ? 'playing' : 'closing';
      setPhase(currentPhase);
      showAccount(false);
      if (reducedMotion.matches) { finish(open); return; }
      const started = performance.now();
      function tick(now: number) {
        frame = 0;
        if (disposed) return;
        const raw = Math.min(1, Math.max(0, (now - started) / durationMs));
        // Normalized exponential ease-out: quick flip, long gentle settle,
        // with exact 0/1 endpoints in both directions.
        const eased = -Math.expm1(-4 * raw) / -Math.expm1(-4);
        sync(open ? eased : 1 - eased);
        if (open && raw >= .8) showAccount(true);
        if (raw >= 1) finish(open);
        else frame = requestAnimationFrame(tick);
      }
      frame = requestAnimationFrame(tick);
    }
    function onScroll() {
      const { top, travel } = geometry();
      const displacement = window.scrollY - top;
      if (currentPhase === 'idle' && displacement >= 36) animate(true);
      else if (currentPhase === 'review' && travel - displacement >= 36) {
        currentPhase = 'closing';
        setPhase('closing');
        awaitingAccountExit = true;
        accountExitComplete = false;
        showAccount(false);
        if (reducedMotion.matches) finish(false);
      }
    }
    function beginReturn() {
      if (!awaitingAccountExit || !accountExitComplete || disposed || document.visibilityState === 'hidden') return;
      awaitingAccountExit = false;
      animate(false);
    }
    accountHiddenRef.current = () => {
      accountExitComplete = true;
      beginReturn();
    };
    function onVisibilityChange() { if (document.visibilityState === 'visible') beginReturn(); }
    function onResize() { sync(progress); }
    function onReducedMotion() {
      if (!reducedMotion.matches) return;
      cancelAnimationFrame(frame); frame = 0;
      if (currentPhase === 'playing') finish(true);
      else if (currentPhase === 'closing') finish(false);
    }
    setPhase('idle');
    setShowForm(false);
    setFrontVisible(false);
    sync(0);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    reducedMotion.addEventListener('change', onReducedMotion);
    return () => {
      disposed = true;
      accountHiddenRef.current = null;
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotion.removeEventListener('change', onReducedMotion);
    };
  }, [enabled, onProgress]);
  return { journeyRef, phase, showForm, frontVisible, onAccountHidden };
}
