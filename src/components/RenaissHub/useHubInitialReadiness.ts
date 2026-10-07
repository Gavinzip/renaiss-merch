import { useEffect, useRef, useState, type RefObject } from 'react';
import { hubAssetUrl } from '../../lib/hubAssets';
import { staticMerchAssetUrl } from '../../lib/staticAssets';
import type { AccountState } from './RenaissHubFeatures';
import type { CommunityFeedState } from './useCommunityFeed';
import { hubPreviewWordmarkUrl } from './hubPreviewAssets';

type Readiness = 'loading' | 'ready' | 'error';

export function useHubInitialReadiness(account: AccountState, settingsStatus: string, feed: CommunityFeedState, root: RefObject<HTMLElement | null>) {
  const [readiness, setReadiness] = useState<Readiness>('loading');
  const finished = useRef(false);
  useEffect(() => {
    if (finished.current || account.status === 'loading' || settingsStatus === 'loading' || feed.status === 'loading') return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    void (async () => {
      try {
        const critical = [hubPreviewWordmarkUrl(), hubAssetUrl('sealedBoxHero'), staticMerchAssetUrl('storeBackground')];
        await Promise.all(critical.map(source => decodeImage(source, controller.signal)));
        // Feed images in the first viewport settle before the page is revealed.
        // Later images remain lazy and do not delay entry.
        const visibleImages = [...(root.current?.querySelectorAll<HTMLImageElement>('img') || [])]
          .filter(image => { const bounds = image.getBoundingClientRect(); return bounds.top < innerHeight && bounds.bottom > 0 && bounds.width > 0; });
        await Promise.allSettled(visibleImages.map(image => decodeImage(image.currentSrc || image.src, controller.signal)));
        if (controller.signal.aborted) throw new Error('asset_timeout');
        if (!cancelled) { finished.current = true; setReadiness('ready'); }
      } catch {
        if (!cancelled) setReadiness('error');
      } finally { window.clearTimeout(timeout); }
    })();
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timeout); };
  }, [account.status, settingsStatus, feed.status, root]);
  return readiness;
}

function decodeImage(source: string, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new Error('aborted')); return; }
    const image = new Image();
    image.decoding = 'async';
    const abort = () => { image.src = ''; reject(new Error('aborted')); };
    signal.addEventListener('abort', abort, { once: true });
    image.onload = () => { void image.decode().then(resolve, reject).finally(() => signal.removeEventListener('abort', abort)); };
    image.onerror = () => { signal.removeEventListener('abort', abort); reject(new Error('asset_unavailable')); };
    image.src = source;
  });
}
