import { useEffect, useRef } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';

const revealTiming = {
  duration: 700,
  stagger: 70,
  maxDelay: 350,
  easing: 'cubic-bezier(.22,1,.36,1)',
};

// Static markup stays readable. Only elements entering the viewport receive
// a temporary animation; returning to a section never dims it again.
export function useSurfCampaignMotion(locale: AppLocale, revision: number) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const running = new Map<HTMLElement, Animation>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < .16) continue;
        const element = entry.target as HTMLElement;
        observer.unobserve(element);
        if (media.matches || element.contains(document.activeElement)) continue;
        const step = Number(element.dataset.surfReveal);
        const image = element.dataset.surfMotion === 'image';
        const animation = element.animate([
          { opacity: .08, transform: `translate3d(0,${image ? 22 : 16}px,0)`, filter: `blur(${image ? 6 : 8}px)` },
          { opacity: 1, transform: 'translate3d(0,0,0)', filter: 'blur(0)' },
        ], {
          duration: revealTiming.duration,
          easing: revealTiming.easing,
          delay: Math.min(step * revealTiming.stagger, revealTiming.maxDelay),
          fill: 'both',
        });
        running.set(element, animation);
        animation.onfinish = () => {
          // Release the transform so normal hover/focus styling owns it again.
          animation.cancel();
          running.delete(element);
        };
      }
    }, { rootMargin: '0px 0px -5% 0px', threshold: .16 });
    root.current.querySelectorAll<HTMLElement>('[data-surf-reveal]').forEach(element => observer.observe(element));

    const settle = () => {
      if (!media.matches) return;
      running.forEach(animation => animation.cancel());
      running.clear();
    };
    const focus = (event: FocusEvent) => {
      // Keyboard navigation must never wait for a delayed control to reveal.
      for (const [element, animation] of running) {
        if (!element.contains(event.target as Node)) continue;
        animation.cancel();
        running.delete(element);
      }
    };
    const container = root.current;
    media.addEventListener('change', settle);
    container.addEventListener('focusin', focus);
    return () => {
      observer.disconnect();
      running.forEach(animation => animation.cancel());
      media.removeEventListener('change', settle);
      container.removeEventListener('focusin', focus);
    };
  }, [locale, revision]);
  return root;
}
