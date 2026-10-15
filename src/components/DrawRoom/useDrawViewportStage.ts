import { useLayoutEffect, type RefObject } from 'react';

/** Fit the ceremony below its actual header/toolbar, including wrapped text. */
export function useDrawViewportStage(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    const page = stage.closest<HTMLElement>('.surf-draw-page');
    if (!page) return;
    let frame = 0;
    const measure = () => {
      if (page.dataset.theater === 'true') return;
      const top = stage.getBoundingClientRect().top + window.scrollY;
      // Tiny/landscape windows retain a usable scene and may scroll normally.
      const height = Math.max(300, Math.min(800, window.innerHeight - top - 24));
      stage.style.setProperty('--draw-stage-height', `${height}px`);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(page);
    observer.observe(stage);
    window.addEventListener('resize', schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      stage.style.removeProperty('--draw-stage-height');
    };
  }, [ref]);
}
