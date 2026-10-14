import { useEffect, useRef } from 'react';
import { paintSurfDrawBox, surfBoxMotion } from './draw-effects/surfDrawBoxFrames';
import { useSurfDrawMotionAssets } from './surfDrawMotionContext';
import type { RevealPhase } from './useSurfDrawPresentation';

export function SurfDrawBox({ phase, revision, active, onRevealed }: {
  phase: RevealPhase; revision: number; active: boolean;
  onRevealed: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { images } = useSurfDrawMotionAssets();
  const callbacks = useRef({ onRevealed });
  callbacks.current = { onRevealed };

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!images || !context) return;
    let frame = 0;
    let displayed = -1;
    let started: number | undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const last = surfBoxMotion.frames - 1;
    function paint(index: number) {
      if (index !== displayed) { paintSurfDrawBox(context!, images!, index); displayed = index; }
    }
    function finish() {
      cancelAnimationFrame(frame);
      paint(last);
      callbacks.current.onRevealed();
    }
    function tick(now: number) {
      started ??= now;
      const progress = Math.min(1, (now - started) / surfBoxMotion.durationMs);
      paint(Math.floor(progress * last));
      if (progress === 1) finish();
      else frame = requestAnimationFrame(tick);
    }
    function preferenceChanged() { if (reduced.matches && active && phase === 'identity') finish(); }
    if (phase === 'revealed') paint(last);
    else if (active && phase === 'identity') {
      if (reduced.matches) finish();
      else { paint(0); frame = requestAnimationFrame(tick); }
    } else paint(0);
    reduced.addEventListener('change', preferenceChanged);
    return () => { cancelAnimationFrame(frame); reduced.removeEventListener('change', preferenceChanged); };
  }, [images, phase, revision, active]);

  return <div className="surf-draw-box-media" data-prepared={Boolean(images)}>
    <canvas ref={canvas} width={surfBoxMotion.tile} height={surfBoxMotion.tile} role="img" aria-label="Surf Mystery Box" />
  </div>;
}
