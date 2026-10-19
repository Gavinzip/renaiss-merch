import { useEffect, useRef, type RefObject } from 'react';
import type { SurfProMetalController, SurfProMetalStatus } from './mountSurfProMetal';
import { loadSurfProMetal } from './loadSurfProMetal';

type Props = {
  controllerRef: RefObject<SurfProMetalController | null>;
  onStatus: (status: SurfProMetalStatus) => void;
};

export function SurfProMetalCanvas({ controllerRef, onStatus }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let disposed = false;
    let controller: SurfProMetalController | undefined;
    onStatus({ state: 'checking' });
    void loadSurfProMetal().then(({ mountSurfProMetal }) => {
      if (disposed) return;
      controller = mountSurfProMetal(canvas, { disableTelemetry: true, onStatus });
      controllerRef.current = controller;
    }).catch(error => {
      if (disposed) return;
      const reason = error instanceof Error ? error.message : String(error);
      canvas.dataset.gpuState = 'error';
      canvas.dataset.gpuReason = reason;
      onStatus({ state: 'error', reason });
      console.error('[Surf Pro BrushedMetal]', reason);
    });
    return () => { disposed = true; controllerRef.current = null; controller?.destroy(); };
  }, [controllerRef, onStatus]);
  return <canvas className="surf-pro-material" ref={canvasRef} aria-hidden="true" />;
}
