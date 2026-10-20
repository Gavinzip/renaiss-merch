// Entrance timing adapted from React Bits Magic Bento (2026-10-20 registry).
// See docs/licenses/react-bits-magic-bento.md. No hover/glow engine is imported.
const ease = 'cubic-bezier(.22,1,.36,1)';
const spring = 'linear(0,.0603,.2033,.3821,.5633,.7258,.8584,.9574,1.0242,1.0634,1.0809,1.0828,1.0747,1.0613,1.046,1.0313,1.0186,1.0085,1.0012,.9965,.994,.9931,.9933,.9941,.9953,.9966,.9978,.9988,1)';

/** Measure the actual grid, including custom footprints, rather than DOM order. */
export function diagonalWidgetOrder<T extends { left: number; top: number }>(items: T[]) {
  const origin = {
    left: Math.min(...items.map(item => item.left)),
    top: Math.min(...items.map(item => item.top)),
  };
  return [...items].sort((a, b) => {
    const distance = (item: T) => item.left - origin.left + item.top - origin.top;
    return distance(a) - distance(b) || a.top - b.top || a.left - b.left;
  });
}

/** Finite entrance on the surface; outer FLIP and inner edit motion stay owners. */
export function playHubWidgetEntrance(grid: HTMLElement) {
  const animations = new Set<Animation>();
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    animations.forEach(animation => animation.cancel());
    animations.clear();
    delete grid.dataset.entering;
    media.removeEventListener('change', stop);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', stop);
    grid.removeEventListener('focusin', stop);
    grid.removeEventListener('pointerdown', stop);
  };
  const onVisibility = () => { if (document.hidden) stop(); };
  if (media.matches || document.hidden) return stop;

  const pieces = diagonalWidgetOrder(
    [...grid.querySelectorAll<HTMLElement>('[data-widget-id]')].map(frame => {
      const { left, top, width } = frame.getBoundingClientRect();
      return { left, top, width, surface: frame.querySelector<HTMLElement>('.hub-widget__surface')! };
    }).filter(piece => piece.width > 0),
  );
  if (!pieces.length) return stop;

  const run = (element: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) => {
    const animation = element.animate(frames, { fill: 'both', ...options });
    animations.add(animation);
    animation.addEventListener('finish', () => {
      animations.delete(animation);
      animation.cancel(); // Release every property back to existing widget styles.
      if (!animations.size) stop();
    }, { once: true });
  };

  // Content owns its own stagger: heading, artwork, rows and action are separate
  // pieces, measured before animation. Hidden carousel slides never participate.
  const parts = diagonalWidgetOrder(pieces.flatMap(({ surface }, widgetIndex) => {
    const bounds = surface.getBoundingClientRect();
    return [...surface.querySelectorAll<HTMLElement>('[data-hub-enter]')]
      .filter(element => !element.closest('[inert], [hidden]') && !element.parentElement?.closest('[data-hub-enter]'))
      .map(element => {
        const rect = element.getBoundingClientRect();
        return { element, widgetIndex, width: rect.width, height: rect.height,
          left: Math.max(bounds.left, rect.left), top: Math.max(bounds.top, rect.top) };
      }).filter(part => part.width > 0 && part.height > 0);
  }));

  grid.dataset.entering = 'true';
  pieces.forEach(({ surface }, index) => {
    const delay = 140 + index * 100;
    run(surface, [{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay, easing: ease });
    run(surface, [
      { transform: 'translate3d(0,-12px,0) scale(.985)' },
      { transform: 'none' },
    ], { duration: 760, delay, easing: spring });
  });
  parts.forEach(({ element, widgetIndex }, index) => {
    const delay = Math.max(260 + index * 32, 240 + widgetIndex * 100);
    run(element, [{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay, easing: ease });
    // Individual translate composes with the hero's scale, existing centering,
    // carousel transforms and hover effects rather than replacing them.
    run(element, [{ translate: '-6px -12px' }, { translate: '0 0' }],
      { duration: 620, delay, easing: spring });
  });
  media.addEventListener('change', stop);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', stop, { passive: true });
  // A person can interact immediately, including while later cards are delayed.
  grid.addEventListener('focusin', stop);
  grid.addEventListener('pointerdown', stop);
  return stop;
}
