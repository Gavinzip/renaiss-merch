import { useLayoutEffect, useRef, useState } from 'react';
import { createEntranceMotion } from './entranceMotion.js';
import './charizardEntrance.css';

function measureOrigin(button) {
  const page = button.closest('.surf-draw-page');
  if (!page) throw new Error('Charizard entrance requires its draw-page button.');
  const { x, y, width, height } = button.getBoundingClientRect();
  const pageRect = page.getBoundingClientRect();
  const style = getComputedStyle(button);
  const clippingAncestors = [];
  for (let parent = button.parentElement; parent; parent = parent.parentElement) {
    const parentStyle = getComputedStyle(parent);
    if (parentStyle.overflowX !== 'visible' || parentStyle.overflowY !== 'visible') clippingAncestors.push(parent);
    if (parent === page) break;
  }
  return {
    button, page, clippingAncestors, x, y, width, height,
    focalX: x + width / 2 - pageRect.x,
    focalY: y + height / 2 - pageRect.y,
    color: style.color, borderColor: style.borderTopColor,
    radius: Number.parseFloat(style.borderTopLeftRadius),
    transform: style.transform === 'none' ? '' : style.transform,
  };
}

/** The 30th-anniversary button zoom, adapted to the Surf page's in-flow header. */
export function useCharizardEntrance(dialog, button, ready) {
  const [entered, setEntered] = useState(false);
  const start = useRef(null);
  useLayoutEffect(() => {
    if (!button) { setEntered(false); return; }
    const element = dialog.current;
    const source = measureOrigin(button);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setEntered(false);
    element.showModal();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motion = createEntranceMotion(source, document.documentElement.clientWidth, window.innerHeight);
    // This header is in normal flow. It travels with its page, without the old
    // fixed-to-absolute conversion that would shift the button's position here.
    const layers = reduced ? [] : [
      source.page.animate(motion.page, motion.timing),
      source.button.animate(motion.button, motion.timing),
      source.button.animate(motion.label, motion.timing),
      source.button.animate(motion.tone, motion.timing),
      ...source.clippingAncestors.map(parent => parent.animate(motion.unclipped, motion.timing)),
    ];
    const scene = element.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }] : motion.scene,
      reduced ? { duration: 120, easing: 'ease-out', fill: 'both' } : motion.timing);
    const animations = [...layers, scene];
    animations.forEach(animation => { animation.pause(); animation.currentTime = 0; });
    let begun = false, live = true;
    const syncVisibility = () => {
      if (begun) animations.forEach(animation => document.hidden ? animation.pause() : animation.play());
    };
    start.current = () => {
      if (begun) return;
      begun = true;
      element.dataset.entranceStartedAt = performance.now().toFixed(1);
      syncVisibility();
    };
    document.addEventListener('visibilitychange', syncVisibility);
    scene.finished.then(() => {
      if (!live) return;
      document.removeEventListener('visibilitychange', syncVisibility);
      layers.forEach(animation => animation.cancel());
      setEntered(true);
      scene.cancel();
    }, () => { /* Closing cancels the entrance and restores the source page. */ });
    return () => {
      live = false;
      start.current = null;
      document.removeEventListener('visibilitychange', syncVisibility);
      animations.forEach(animation => animation.cancel());
      element.close();
      document.body.style.overflow = overflow;
    };
  }, [dialog, button]);
  useLayoutEffect(() => { if (ready) start.current?.(); }, [ready, dialog, button]);
  return entered;
}
