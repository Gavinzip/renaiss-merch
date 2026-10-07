import { useEffect, useRef, useState, type RefObject } from 'react';

// The visible product covers settle before the first Store paint. Subsequent
// inventory and access refreshes update normally without hiding the page.
export function useStoreInitialReadiness(enabled: boolean, dataReady: boolean, root: RefObject<HTMLElement | null>) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(enabled ? 'loading' : 'ready');
  const finished = useRef(false);
  useEffect(() => {
    if (!enabled || !dataReady || finished.current) return;
    let cancelled = false;
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; if (!cancelled) setState('error'); }, 15_000);
    void (async () => {
      try {
        const images = [...(root.current?.querySelectorAll<HTMLImageElement>('img') || [])]
          .filter(image => { const bounds = image.getBoundingClientRect(); return bounds.top < innerHeight && bounds.bottom > 0 && bounds.width > 0; });
        await Promise.all(images.map(image => image.decode()));
        if (!cancelled && !timedOut) { finished.current = true; setState('ready'); }
      } catch {
        if (!cancelled && !timedOut) setState('error');
      } finally { window.clearTimeout(timer); }
    })();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [enabled, dataReady, root]);
  return state;
}
