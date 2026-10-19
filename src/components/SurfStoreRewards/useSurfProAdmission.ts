import { useEffect, useState } from 'react';
import { hubPreviewWordmarkUrl, surfPreviewLogoUrl } from '../RenaissHub/hubPreviewAssets';
import { artworkAborted, prepareSurfProLogos, type SurfProArtworkProgress, type SurfProLogoUrls } from './prepareSurfProLogos';

export function useSurfProAdmission() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [logos, setLogos] = useState<SurfProLogoUrls>(() => ({ surf: surfPreviewLogoUrl(), renaiss: hubPreviewWordmarkUrl() }));
  const [progress, setProgress] = useState<SurfProArtworkProgress>({ percent: 0, stage: 'download' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]);
    let objectUrls: SurfProLogoUrls | undefined;
    let renderFrame = 0;
    setReady(false); setError(false);
    setProgress({ percent: 0, stage: 'download' });
    async function prepare() {
      objectUrls = await prepareSurfProLogos(signal, setProgress);
      if (signal.aborted) {
        Object.values(objectUrls).forEach(url => URL.revokeObjectURL(url));
        objectUrls = undefined;
        throw signal.reason;
      }
      signal.throwIfAborted();
      setLogos(objectUrls);
      setProgress({ percent: 99, stage: 'render' });
      await Promise.race([
        new Promise<void>(resolve => {
          renderFrame = requestAnimationFrame(() => {
            renderFrame = requestAnimationFrame(() => { renderFrame = 0; resolve(); });
          });
        }),
        artworkAborted(signal)
      ]);
      signal.throwIfAborted();
      setProgress({ percent: 100, stage: 'render' }); setReady(true);
    }
    void prepare().catch(() => {
      if (!controller.signal.aborted) { setError(true); controller.abort(); }
    });
    return () => {
      controller.abort();
      cancelAnimationFrame(renderFrame);
      if (objectUrls) Object.values(objectUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [revision]);
  return { ready, error, logoUrl: logos.surf, renaissLogoUrl: logos.renaiss, progress, retry: () => setRevision(value => value + 1) };
}
