import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Use the existing route's per-piece motion approach: fixed controls retain
// their viewport positioning and long pages do not become one blurred layer.
const hubPieces = '.hub-home-intro__utility, .hub-widget__surface, .renaiss-hub__footer, .assistant-launch';
const storePieces = '.merch-store__header, .merch-store__intro, .merch-product-card, .catalog-item, .surf-store-card';

export function useStorePageTransition(view: 'landing' | 'store', enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const animations = useRef(new Set<Animation>());
  const previousView = useRef(view);
  const generation = useRef(0);
  const needsEntry = useRef(false);
  const focusPending = useRef(false);
  const [busy, setBusy] = useState(false);

  const cancel = useCallback(() => {
    animations.current.forEach(animation => animation.cancel());
    animations.current.clear();
  }, []);
  const run = useCallback((entering: boolean, page: 'landing' | 'store') => {
    const root = ref.current;
    if (!root) return [];
    const styles = getComputedStyle(root);
    const durationValue = styles.getPropertyValue('--page-slide-dur').trim();
    const duration = parseFloat(durationValue) * (durationValue.endsWith('ms') ? 1 : 1000);
    const distance = parseFloat(styles.getPropertyValue('--page-slide-distance'));
    const blur = parseFloat(styles.getPropertyValue('--page-blur'));
    const easing = styles.getPropertyValue('--page-slide-ease').trim();
    if (![duration, distance, blur].every(Number.isFinite) || !easing) throw new Error('Missing Store page motion tokens');
    const elements = [...root.querySelectorAll<HTMLElement>(page === 'store' ? storePieces : hubPieces)]
      .filter(element => { const rect = element.getBoundingClientRect(); return rect.top < innerHeight && rect.bottom > 0 && rect.width > 0; });
    return elements.map((element, index) => {
      // Release any first-mount reveal before the page coordinator takes over.
      element.getAnimations().forEach(animation => animation.cancel());
      const rest = { opacity: 1, transform: 'none', filter: 'blur(0px)' };
      const transit = { opacity: 0.08, transform: `translateX(${entering ? distance : -distance}px)`, filter: `blur(${blur}px)` };
      const animation = element.animate(entering ? [transit, rest] : [rest, transit], {
        duration, easing, delay: entering ? Math.min(index * 40, 120) : 0, fill: 'both'
      });
      animations.current.add(animation);
      return animation;
    });
  }, []);

  const leave = useCallback(async () => {
    if (!enabled) return true;
    const ticket = ++generation.current;
    needsEntry.current = true;
    cancel(); setBusy(true);
    if (!document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await Promise.allSettled(run(false, 'landing').map(animation => animation.finished));
    }
    if (ticket !== generation.current) { needsEntry.current = false; setBusy(false); return false; }
    return true;
  }, [enabled, cancel, run]);

  useLayoutEffect(() => {
    const changed = previousView.current !== view;
    previousView.current = view;
    if (!enabled || (!changed && !needsEntry.current)) return;
    const ticket = ++generation.current;
    needsEntry.current = false;
    cancel();
    window.scrollTo({ top: 0, behavior: 'instant' });
    focusPending.current = true;
    if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) { setBusy(false); return; }
    setBusy(true);
    const entering = run(true, view);
    void Promise.allSettled(entering.map(animation => animation.finished)).then(() => {
      if (ticket !== generation.current) return;
      cancel(); setBusy(false);
    });
  }, [view, enabled, cancel, run]);

  useLayoutEffect(() => {
    if (!busy && focusPending.current) {
      focusPending.current = false;
      ref.current?.querySelector<HTMLElement>(view === 'store' ? '.merch-store__brand' : '.renaiss-hub__brand')?.focus({ preventScroll: true });
    }
  }, [busy, view]);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const settle = () => { if (document.hidden || media.matches) cancel(); };
    document.addEventListener('visibilitychange', settle); media.addEventListener('change', settle);
    return () => {
      ++generation.current; cancel();
      document.removeEventListener('visibilitychange', settle); media.removeEventListener('change', settle);
    };
  }, [cancel]);

  return { ref, busy, leave };
}
