import { useLayoutEffect, useRef } from 'react';
import './archiveFocus.css';

const timing = { duration: 700, stagger: 80, maxDelay: 320, easing: 'cubic-bezier(.22,1,.36,1)' };

// A document's entrance belongs to its visible semantic pieces, rather than a
// page-sized wrapper. Offscreen sections start only when they come into view.
export function useArchiveEntrance(selector: string, delay = 0, stagger = timing.stagger) {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const running = new Map<HTMLElement, Animation>();
    const seen = new Set<HTMLElement>();
    const targets = [...container.querySelectorAll<HTMLElement>(selector)];
    function reveal(elements: HTMLElement[]) {
      elements.forEach((element, index) => {
        seen.add(element);
        if (reduced.matches || document.hidden || element.contains(document.activeElement)) return;
        const animation = element.animate([
          { opacity: .08, translate: '0 16px', filter: 'blur(8px)' },
          { opacity: 1, translate: '0 0', filter: 'blur(0px)' },
        ], {
          duration: timing.duration,
          delay: Math.min(delay + index * stagger, timing.maxDelay),
          easing: timing.easing,
          fill: 'both',
        });
        running.set(element, animation);
        element.dataset.archiveEntrance = 'running';
        animation.onfinish = () => {
          // Release animation styles so hover and the original ceremony own
          // their transforms, stacking contexts and opacity again.
          animation.cancel();
          running.delete(element);
          element.dataset.archiveEntrance = 'complete';
        };
      });
    }
    const observer = new IntersectionObserver(entries => {
      const entering = entries.filter(entry => entry.isIntersecting && !seen.has(entry.target as HTMLElement));
      entering.forEach(entry => observer.unobserve(entry.target));
      reveal(entering.map(entry => entry.target as HTMLElement));
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    const visible = targets.filter(element => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0;
    });
    // Start before the first paint; no mounted-state gate or artificial wait.
    reveal(visible);
    targets.filter(element => !seen.has(element)).forEach(element => observer.observe(element));
    function settle() {
      running.forEach((animation, element) => {
        animation.cancel();
        element.dataset.archiveEntrance = 'complete';
      });
      running.clear();
    }
    function preferenceChanged() { if (reduced.matches) settle(); }
    function focus(event: FocusEvent) {
      running.forEach((animation, element) => {
        if (!element.contains(event.target as Node)) return;
        animation.cancel();
        running.delete(element);
        element.dataset.archiveEntrance = 'complete';
      });
    }
    function visibilityChanged() { if (document.hidden) settle(); }
    reduced.addEventListener('change', preferenceChanged);
    container.addEventListener('focusin', focus);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      observer.disconnect();
      settle();
      reduced.removeEventListener('change', preferenceChanged);
      container.removeEventListener('focusin', focus);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [selector, delay, stagger]);
  return root;
}
