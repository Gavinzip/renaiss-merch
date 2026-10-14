import { useId, useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { RevealPhase } from './useSurfDrawPresentation';
import './SurfDrawReels.css';

const rows = Array.from({ length: 60 }, (_, row) => row % 10);
const translate = (row: number) => `translateY(calc(var(--reel-cell) * ${-row}))`;

// Keep the same strips mounted from the first spin through the final stop.
// A confirmed ticket only becomes visible after the presentation's minimum hold.
export function SurfDrawReels({ number, phase, revision, onSettled, onStops }: {
  number: number | null; phase: RevealPhase; revision: number; onSettled: () => void; onStops: (count: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const strips = useRef<(HTMLDivElement | null)[]>([]);
  const blurs = useRef<(SVGFEGaussianBlurElement | null)[]>([]);
  const complete = useRef(onSettled);
  complete.current = onSettled;
  const stopsChanged = useRef(onStops);
  stopsChanged.current = onStops;
  const id = useId().replace(/:/g, '');
  const digits = String(number ?? 0).padStart(6, '0');

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const css = getComputedStyle(node);
    const cell = parseFloat(css.getPropertyValue('--reel-cell'));
    const duration = parseFloat(css.getPropertyValue('--reel-dur'));
    const stagger = parseFloat(css.getPropertyValue('--reel-stagger'));
    const ease = css.getPropertyValue('--reel-ease').trim();
    const blur = parseFloat(css.getPropertyValue('--reel-spin-blur'));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const elements = [...strips.current];
    const animations: Animation[] = [];
    let active = true;
    let frame = 0;
    let stopped = 0;
    const started = performance.now();
    if (phase === 'spinning') { node.style.setProperty('--locked', '0'); stopsChanged.current(0); }

    elements.forEach((strip, index) => {
      if (!strip) return;
      const digit = Number(digits[index]);
      const y = new DOMMatrixReadOnly(getComputedStyle(strip).transform).m42;
      const row = Math.max(0, -y / cell);
      const setBlur = (value: number) => blurs.current[index]?.setAttribute('stdDeviation', `0 ${value}`);
      strip.dataset.reelState = phase === 'spinning' ? 'spinning' : phase === 'settling' ? 'settling' : 'stopped';
      if (phase === 'spinning' && !reduced) {
        // Whole rotations leave exactly the same visible digit at the join.
        const start = 10 + row % 10;
        strip.style.transform = translate(start);
        setBlur(blur);
        animations.push(strip.animate([{ transform: translate(start) }, { transform: translate(start + 10) }],
          { duration: 450 + index * 43, iterations: Infinity, easing: 'linear', fill: 'both' }));
      } else if (phase === 'settling' && !reduced) {
        const target = Math.ceil((row + 10 - digit) / 10) * 10 + digit;
        const animation = strip.animate([{ transform: translate(row) }, { transform: translate(target) }],
          { duration: duration + index * stagger, easing: ease, fill: 'both' });
        animations.push(animation);
        animation.onfinish = () => {
          if (!active) return;
          strip.style.transform = translate(target);
          strip.dataset.reelState = 'stopped';
          setBlur(0);
          animation.cancel();
          node.style.setProperty('--locked', String(++stopped));
          stopsChanged.current(stopped);
          if (stopped === 6) complete.current();
        };
      } else {
        strip.style.transform = translate(10 + digit);
        setBlur(0);
      }
    });

    if (phase === 'settling') {
      if (reduced) queueMicrotask(() => { if (active) { stopsChanged.current(6); complete.current(); } });
      else {
        const decayBlur = () => {
          if (!active) return;
          const elapsed = performance.now() - started;
          blurs.current.forEach((filter, index) => {
            const progress = Math.min(1, elapsed / (duration + index * stagger));
            filter?.setAttribute('stdDeviation', `0 ${blur * (1 - progress) ** 2}`);
          });
          if (elapsed < duration + 5 * stagger) frame = requestAnimationFrame(decayBlur);
        };
        frame = requestAnimationFrame(decayBlur);
      }
    }
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      // Capture before cancelling: deceleration starts at this exact position.
      elements.forEach(strip => { if (strip) strip.style.transform = getComputedStyle(strip).transform; });
      animations.forEach(animation => animation.cancel());
    };
  }, [phase, revision, digits]);

  const empty = number === null && phase !== 'spinning' && phase !== 'settling';
  return <div ref={root} className="surf-draw-reels" data-phase={phase} data-empty={empty} aria-hidden="true">
    <svg width="0" height="0" className="surf-draw-filter-defs"><defs>{Array.from({ length: 6 }, (_, index) =>
      <filter id={`${id}-blur-${index}`} key={index}><feGaussianBlur ref={element => { blurs.current[index] = element; }} stdDeviation="0 0" /></filter>)}</defs></svg>
    {Array.from({ length: 6 }, (_, index) => <div className="t-reel-col" key={index}>
      <div className="t-reel-strip" ref={element => { strips.current[index] = element; }}
        style={{ filter: `url('#${id}-blur-${index}')` } as CSSProperties}>
        {rows.map((digit, row) => <span className="t-reel-digit" key={row}>{digit}</span>)}
      </div>
    </div>)}
    <div className="surf-draw-reels__rail"><i className="surf-draw-reels__rail-fill" /></div>
    {empty ? <span className="surf-draw-reels__word">REVEAL</span> : null}
  </div>;
}
