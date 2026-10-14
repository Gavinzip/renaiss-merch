import { useLayoutEffect, useRef, useState } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { surfWinnerDisplayName } from '../../../shared/surf-draw-identity.js';
import { HubWordmark } from './HubWordmark';
import { SurfLogo } from './SurfLogo';
import { SurfDrawReels } from './SurfDrawReels';
import { surfDrawSceneCopy } from './SurfDrawSceneCopy';
import type { Winner } from './useSurfDraw';
import type { RevealPhase } from './useSurfDrawPresentation';
import './SurfDrawTicket.css';

export function SurfDrawTicket({ locale, winner, phase, simulation, revision, slot, onSettled, onStops, onIdentityRevealed }: {
  locale: AppLocale; winner?: Winner; phase: RevealPhase; simulation: boolean; revision: number; slot: number;
  onSettled: () => void; onStops: (count: number) => void; onIdentityRevealed: () => void;
}) {
  const copy = surfDrawSceneCopy(locale);
  const identity = phase === 'identity' || phase === 'revealed';
  const name = identity ? surfWinnerDisplayName(winner?.participant.name) : '';
  const block = useRef<HTMLDivElement>(null);
  const nameText = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(phase === 'revealed');
  const complete = useRef(onIdentityRevealed);
  complete.current = onIdentityRevealed;

  useLayoutEffect(() => {
    let active = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const preferenceChanged = () => { if (active && phase === 'identity' && reduced.matches) complete.current(); };
    if (phase === 'identity') {
      // Establish the entry position before showing ReactSkills' text reveal.
      void block.current?.offsetHeight;
      setShown(true);
      if (reduced.matches) {
        queueMicrotask(() => { if (active) complete.current(); });
      }
    } else setShown(phase === 'revealed');
    reduced.addEventListener('change', preferenceChanged);
    return () => { active = false; reduced.removeEventListener('change', preferenceChanged); };
  }, [phase]);

  return <div className="surf-reveal-ticket surf-draw-ticket" data-identity={identity} data-phase={phase}>
    <div className="surf-reveal-ticket__metal" />
    <div className="surf-reveal-ticket__top">
      <div className="surf-draw-ticket__brands"><HubWordmark /><b aria-hidden="true">×</b><SurfLogo /><span>SURF</span></div>
      <i>DRAW / {String(slot + 1).padStart(3, '0')}</i>
    </div>
    <div className="surf-draw-ticket__body">
      <span className="surf-draw-ticket__caption">{simulation ? copy.simulation : winner || phase === 'spinning' ? copy.ticket : copy.pending}</span>
      <div className="surf-draw-ticket__reels">
        <SurfDrawReels number={winner?.ticketNumber ?? null} phase={phase} revision={revision} onSettled={onSettled} onStops={onStops} />
      </div>
      <div ref={block} className={`surf-draw-ticket__identity t-stagger${shown ? ' is-shown' : ''}`} aria-hidden={!identity}
        onTransitionEnd={event => {
          if (phase === 'identity' && event.target === nameText.current && event.propertyName === 'transform') complete.current();
        }}>
        {identity ? <>
          <span className="t-stagger-line t-stagger-line--1">{copy.winnerLabel}</span>
          <strong ref={nameText} className="t-stagger-line t-stagger-line--2" data-size={name.length > 40 ? 'long' : name.length > 20 ? 'medium' : 'short'}>{name || copy.nameUnavailable}</strong>
        </> : null}
      </div>
    </div>
    <div className="surf-reveal-ticket__bottom"><span>{simulation ? 'LOCAL SIMULATION' : phase === 'spinning' || phase === 'settling' ? 'VERIFYING THE MOMENT' : winner ? 'ON-CHAIN VERIFIED' : 'EVERY TICKET COUNTS'}</span><i>01—27</i><b className="surf-reveal-ticket__barcode" /></div>
  </div>;
}
