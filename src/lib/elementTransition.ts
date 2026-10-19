export type ElementTransition = { finished: Promise<void>; cancel: () => void };
export type ElementTransitionTiming = { duration?: number; stagger?: number; maxDelay?: number };

// Preserve each element's own geometry (including the card's physical flip).
// In-place groups hide only after their last child finishes leaving.
// Page navigation does not wait for an exit animation.
export function transitionElements(
  root: HTMLElement,
  selector: string,
  direction: 'enter' | 'exit',
  previous?: ElementTransition,
  fromCurrent = false,
  visibleOnly = false,
  timing: ElementTransitionTiming = {}
): ElementTransition {
  const elements = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(element => {
    if (!visibleOnly) return true;
    const rect = element.getBoundingClientRect();
    return getComputedStyle(element).visibility !== 'hidden' && rect.width > 0 && rect.height > 0 &&
      rect.bottom > 0 && rect.top < window.innerHeight;
  });
  if (direction === 'exit') elements.reverse();
  const starts = elements.map(element => {
    const style = getComputedStyle(element);
    return { opacity: style.opacity, translate: style.translate, filter: style.filter };
  });
  previous?.cancel();
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches) return { finished: Promise.resolve(), cancel() {} };
  const animations = elements.map((element, index) => element.animate([
    direction === 'exit' || fromCurrent ? starts[index] : { opacity: .06, translate: '0 18px', filter: 'blur(8px)' },
    direction === 'enter' ? { opacity: element.matches('button:disabled') ? .72 : 1, translate: '0 0', filter: 'blur(0)' } : { opacity: .06, translate: '0 -12px', filter: 'blur(8px)' }
  ], {
    duration: timing.duration ?? (direction === 'enter' ? 600 : 360),
    delay: Math.min(index * (timing.stagger ?? 65), timing.maxDelay ?? Infinity),
    easing: direction === 'enter' ? 'cubic-bezier(.22,1,.36,1)' : 'cubic-bezier(.4,0,.6,1)',
    fill: 'both'
  }));
  function reduce() { if (preference.matches) animations.forEach(animation => animation.finish()); }
  preference.addEventListener('change', reduce);
  return {
    finished: Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      preference.removeEventListener('change', reduce);
    }),
    cancel() {
      preference.removeEventListener('change', reduce);
      animations.forEach(animation => animation.cancel());
    }
  };
}
