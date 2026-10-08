import { useEffect, useRef } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { surfCampaignCopy } from './SurfCampaignCopy';
import { surfCampaignAssets } from './surfCampaignAssets';

// Intentionally 2.5D: the official alpha artwork stays intact. No inferred
// back faces, redrawn stock logos, generated image or WebGL runtime.
export function SurfCampaignArt({ locale }: { locale: AppLocale }) {
  const copy = surfCampaignCopy[locale];
  const image = useRef<HTMLImageElement>(null);
  const frame = useRef<number | null>(null);
  const reduced = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);
  function reset() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    image.current?.style.setProperty('--box-rotate-x', '0deg');
    image.current?.style.setProperty('--box-rotate-y', '0deg');
  }
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => { reduced.current = media.matches; reset(); };
    const hide = () => { if (document.hidden) reset(); };
    media.addEventListener('change', change);
    document.addEventListener('visibilitychange', hide);
    return () => { media.removeEventListener('change', change); document.removeEventListener('visibilitychange', hide); reset(); };
  }, []);
  return <figure className="surf-page__hero-art" data-surf-reveal="5" data-surf-motion="image" onPointerLeave={reset} onPointerCancel={reset}
    onPointerMove={event => {
      if (reduced.current || event.pointerType !== 'mouse' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        image.current?.style.setProperty('--box-rotate-x', `${y * -4}deg`);
        image.current?.style.setProperty('--box-rotate-y', `${x * 6}deg`);
      });
    }}>
    <img ref={image} src={surfCampaignAssets().box} alt={copy.boxAlt} width={800} height={800} fetchPriority="high" />
  </figure>;
}
