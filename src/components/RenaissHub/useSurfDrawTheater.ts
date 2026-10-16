import { useLayoutEffect, useRef, type RefObject } from 'react';

const EASE = 'cubic-bezier(.22,1,.36,1)';
const WINNER_HOLD_MS = 1600;

// Move the original DOM into a viewport composition. FLIP preserves the ticket,
// live reels and canvas while their layout changes; no second scene is mounted.
function mountTheater(stage: HTMLElement, slot: HTMLElement) {
  const page = stage.closest<HTMLElement>('.surf-draw-page')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const getSubjects = () => [...stage.querySelectorAll<HTMLElement>('.surf-reveal-prize__caption,.surf-reveal-prize__object,.surf-reveal-prize__name,:scope > .surf-reveal-ticket-scene,.surf-batch-heading')];
  const peripheral = [...page.querySelectorAll<HTMLElement>('.surf-draw-masthead,.surf-draw-results,.surf-draw-proof,.surf-draw-page__footer')]
    .map(element => ({ element, inert: element.inert }));
  const animations = new Set<Animation>();
  let entered = false;
  let leaveTimer: number | undefined;
  let bodyOverflow = '';
  let bodyPadding = '';

  function measureHeader() {
    const header = page.querySelector<HTMLElement>('.hub-site-header');
    page.style.setProperty('--surf-theater-header-height', `${header?.getBoundingClientRect().height ?? 0}px`);
  }

  function changeLayout(next: boolean) {
    if (next === entered) return;
    const subjects = getSubjects();
    const before = subjects.map(element => element.getBoundingClientRect());
    animations.forEach(animation => animation.cancel());
    animations.clear();
    if (next) {
      slot.style.minHeight = `${stage.getBoundingClientRect().height}px`;
      bodyOverflow = document.body.style.overflow;
      bodyPadding = document.body.style.paddingRight;
      const scrollbar = innerWidth - document.documentElement.clientWidth;
      if (scrollbar) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = bodyOverflow;
      document.body.style.paddingRight = bodyPadding;
      slot.style.minHeight = '';
    }
    entered = next;
    page.dataset.theater = String(next);
    peripheral.forEach(({ element, inert }) => { element.inert = next || inert; });
    measureHeader();
    // Reset old scroll so the winner stays inside the viewport composition.
    window.scrollTo({ top: 0, behavior: 'instant' });
    subjects.forEach((element, index) => {
      const from = before[index];
      const to = element.getBoundingClientRect();
      if (reduced.matches || !to.width || !to.height) return;
      // Preserve the artwork and letterforms' aspect ratio during the move.
      const scale = element.classList.contains('surf-reveal-ticket-scene') ? from.width / to.width : from.height / to.height;
      const x = from.left + from.width / 2 - to.left - to.width / 2;
      const y = from.top + from.height / 2 - to.top - to.height / 2;
      const animation = element.animate([
        { transformOrigin: '50% 50%', transform: `translate(${x}px,${y}px) scale(${scale})` },
        { transformOrigin: '50% 50%', transform: 'none' },
      ], { duration: next ? 1100 : 900, easing: EASE, fill: 'both' });
      animations.add(animation);
      animation.onfinish = () => { animation.cancel(); animations.delete(animation); };
    });
  }
  function preferenceChanged() {
    if (reduced.matches) { animations.forEach(animation => animation.cancel()); animations.clear(); }
  }
  reduced.addEventListener('change', preferenceChanged);
  window.addEventListener('resize', measureHeader);
  return {
    setActive(active: boolean, exitImmediately = false) {
      clearTimeout(leaveTimer);
      if (active) changeLayout(true);
      else if (entered) {
        if (exitImmediately) changeLayout(false);
        else leaveTimer = window.setTimeout(() => changeLayout(false), WINNER_HOLD_MS);
      }
    },
    dispose() {
      clearTimeout(leaveTimer);
      animations.forEach(animation => animation.cancel());
      reduced.removeEventListener('change', preferenceChanged);
      window.removeEventListener('resize', measureHeader);
      if (entered) { document.body.style.overflow = bodyOverflow; document.body.style.paddingRight = bodyPadding; }
      delete page.dataset.theater;
      page.style.removeProperty('--surf-theater-header-height');
      peripheral.forEach(({ element, inert }) => { element.inert = inert; });
      slot.style.minHeight = '';
    },
  };
}

export function useSurfDrawTheater(stage: RefObject<HTMLElement | null>, slot: RefObject<HTMLDivElement | null>, active: boolean, exitImmediately = false) {
  const controller = useRef<ReturnType<typeof mountTheater> | undefined>(undefined);
  useLayoutEffect(() => {
    if (!stage.current || !slot.current) return;
    controller.current = mountTheater(stage.current, slot.current);
    return () => { controller.current?.dispose(); controller.current = undefined; };
  }, [stage, slot]);
  useLayoutEffect(() => { controller.current?.setActive(active, exitImmediately); }, [active, exitImmediately]);
}
