import { useEffect, useRef } from 'react';
import type { RevealPhase } from './useSurfDrawPresentation';
import type { createSurfDrawAtmosphere } from './draw-effects/surfDrawAtmosphere';
import './SurfDrawCinema.css';

export function SurfDrawCinema({ phase, stops, revision, batch = false, proBatch = false, onReady, onError }: {
  phase: RevealPhase; stops: number; revision: number; batch?: boolean; proBatch?: boolean;
  onReady: () => void; onError: (message: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createSurfDrawAtmosphere> | null>(null);
  const latest = useRef({ phase, stops, revision, batch, boxBatch: batch && !proBatch });
  latest.current = { phase, stops, revision, batch, boxBatch: batch && !proBatch };
  useEffect(() => {
    let disposed = false, timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      if (!disposed) onError('The WebGPU graphics module did not load. Reload to retry.');
    }, 15000);
    // Keep the board/header cheap to load; graphics prepare independently and
    // must pass their real first-frame gate before a new draw can start.
    void import('./draw-effects/surfDrawAtmosphere').then(({ createSurfDrawAtmosphere }) => {
      clearTimeout(timeout);
      if (disposed || timedOut || !canvas.current) return;
      renderer.current = createSurfDrawAtmosphere(canvas.current, { onReady, onError });
      renderer.current.setState(latest.current);
    }).catch(error => { clearTimeout(timeout); if (!disposed && !timedOut) onError(error instanceof Error ? error.message : String(error)); });
    return () => { disposed = true; clearTimeout(timeout); renderer.current?.dispose(); renderer.current = null; };
  }, [onReady, onError]);
  useEffect(() => { renderer.current?.setState({ phase, stops, revision, batch, boxBatch: batch && !proBatch }); }, [phase, stops, revision, batch, proBatch]);
  return <div className="surf-draw-cinema" data-phase={phase} data-stops={stops} data-pro-batch={proBatch} aria-hidden="true">
    <canvas ref={canvas} className="surf-draw-cinema__canvas" />
    <div className="surf-draw-cinema__pro-lightfield"><i /><i /><i /></div>
    <div className="surf-draw-cinema__top-light" />
  </div>;
}
