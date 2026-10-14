import { useLayoutEffect, useRef, useState } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { useSurfDrawMotionAssets } from './surfDrawMotionContext';
import { SurfProCredential } from '../SurfStoreRewards/SurfProCredential';
import { SurfProPartnerMarks } from '../SurfStoreRewards/SurfProPartnerMarks';
import { surfProCopy } from '../SurfStoreRewards/surfProCopy';
import type { RevealPhase } from './useSurfDrawPresentation';

export function SurfDrawMembership({ locale, phase, active, onRevealed }: {
  locale: AppLocale; phase: RevealPhase; active: boolean;
  onRevealed: () => void;
}) {
  const { logos } = useSurfDrawMotionAssets();
  const [open, setOpen] = useState(phase === 'revealed');
  const turn = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onRevealed });
  callbacks.current = { onRevealed };
  useLayoutEffect(() => {
    let live = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    function finishReduced() { if (live && reduced.matches && active && phase === 'identity') callbacks.current.onRevealed(); }
    if (active && phase === 'identity' && logos) {
      void turn.current?.offsetHeight;
      setOpen(true);
      if (reduced.matches) queueMicrotask(finishReduced);
    } else setOpen(active && phase === 'revealed');
    reduced.addEventListener('change', finishReduced);
    return () => { live = false; reduced.removeEventListener('change', finishReduced); };
  }, [active, phase, logos]);
  return <div className="surf-draw-membership" data-open={open} data-prepared={Boolean(logos)}>
    <div ref={turn} className="surf-draw-membership__turn" onTransitionEnd={event => {
      if (active && phase === 'identity' && event.target === turn.current && event.propertyName === 'transform') callbacks.current.onRevealed();
    }}>
      <div className="surf-draw-membership__face surf-draw-membership__front" aria-hidden={!open}>
        {logos ? <SurfProCredential logoUrl={logos.surf} duration={surfProCopy[locale].duration} /> : null}
      </div>
      <div className="surf-draw-membership__face surf-draw-membership__back" aria-hidden={open}>
        <SurfProCredential logoUrl="" duration="" surfaceOnly />
        <svg className="surf-pro-credential" viewBox="0 0 720 472" role="img" aria-label="Renaiss × Surf">
          {logos ? <SurfProPartnerMarks surfLogoUrl={logos.surf} renaissLogoUrl={logos.renaiss} /> : null}
        </svg>
      </div>
    </div>
  </div>;
}
