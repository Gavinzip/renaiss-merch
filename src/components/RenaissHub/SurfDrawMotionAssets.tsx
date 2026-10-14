import { useEffect, useState, type ReactNode } from 'react';
import { prepareSurfProLogos, type SurfProLogoUrls } from '../SurfStoreRewards/prepareSurfProLogos';
import { prepareSurfDrawBoxFrames } from './draw-effects/surfDrawBoxFrames';
import { surfDrawMediaInitial } from './surfDrawMedia';
import { SurfDrawMotionContext } from './surfDrawMotionContext';

// The page owns decoded artwork. Switching between live status and local
// rehearsal keeps the same resources, so a ready prize cannot flash a loader.
export function SurfDrawMotionAssets({ children }: { children: ReactNode }) {
  const [box, setBox] = useState(surfDrawMediaInitial);
  const [card, setCard] = useState(surfDrawMediaInitial);
  const [images, setImages] = useState<ImageBitmap[]>();
  const [logos, setLogos] = useState<SurfProLogoUrls>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    let owned: ImageBitmap[] | undefined;
    setImages(undefined); setBox(surfDrawMediaInitial);
    void prepareSurfDrawBoxFrames(signal, setBox).then(prepared => {
      owned = prepared;
      if (signal.aborted) { prepared.forEach(image => image.close()); return; }
      setImages(prepared);
      setBox({ stage: 'render', percent: 100, ready: true, error: false });
    }).catch(error => {
      if (!controller.signal.aborted) {
        console.error('Surf draw box preparation failed', error);
        setBox({ ...surfDrawMediaInitial, error: true });
      }
    });
    return () => { controller.abort(); owned?.forEach(image => image.close()); };
  }, [attempt]);
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    let owned: SurfProLogoUrls | undefined;
    let frame = 0;
    setLogos(undefined); setCard(surfDrawMediaInitial);
    void prepareSurfProLogos(signal, progress => setCard({ ...progress, ready: false, error: false })).then(prepared => {
      owned = prepared;
      if (signal.aborted) { Object.values(prepared).forEach(url => URL.revokeObjectURL(url)); return; }
      setLogos(prepared);
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
        if (!signal.aborted) setCard({ stage: 'render', percent: 100, ready: true, error: false });
      }); });
    }).catch(error => {
      if (!controller.signal.aborted) {
        console.error('Surf draw membership artwork failed', error);
        setCard({ ...surfDrawMediaInitial, error: true });
      }
    });
    return () => { controller.abort(); cancelAnimationFrame(frame); if (owned) Object.values(owned).forEach(url => URL.revokeObjectURL(url)); };
  }, [attempt]);
  return <SurfDrawMotionContext.Provider value={{ box, card, images, logos, retry: () => setAttempt(value => value + 1) }}>{children}</SurfDrawMotionContext.Provider>;
}
