import { CEREMONY, boxOpening, boxExposure, smooth } from './ceremonyTimeline';
import './surfCeremonyExposure.css';

// Both surfaces are mounted outside the draw stage so the final exposure can
// reach the header and viewport edges. They never intercept input, and are
// removed with the 3D scene. The flash is one finite cue, not a looping effect.
export function createSurfCeremonyWhiteout() {
  const tension = document.createElement('div');
  tension.className = 'surf-ceremony-tension';
  tension.setAttribute('aria-hidden', 'true');
  const light = document.createElement('div');
  light.className = 'surf-ceremony-light';
  light.setAttribute('aria-hidden', 'true');
  const white = document.createElement('div');
  white.className = 'surf-ceremony-whiteout';
  white.setAttribute('aria-hidden', 'true');
  document.body.append(tension, light, white);

  return {
    render(phase: string, kind: string, age: number, reduced: boolean, source: { x: number; y: number; width: number }) {
      const active = phase === 'settling' && kind === 'mystery-box' && !reduced;
      const charge = active ? boxOpening(age).charge : 0;
      const cue = boxExposure(age);
      const exposure = active ? cue.white : 0;
      // A luminous slit at the physical seal expands into the exposure. There
      // is no detached ring; the entire bloom stays filled with white light.
      const spread = active ? cue.expansion * (1 - smooth((age - CEREMONY.whiteHoldEnd) / .65)) : 0;
      const reach = Math.hypot(innerWidth, innerHeight);
      const radiusX = source.width * .60 + reach * 1.1 * spread;
      const radiusY = 8 + charge * 34 + reach * .85 * spread;
      light.style.setProperty('--light-x', `${source.x}px`);
      light.style.setProperty('--light-y', `${source.y}px`);
      light.style.setProperty('--light-width', `${radiusX}px`);
      light.style.setProperty('--light-height', `${radiusY}px`);
      light.style.opacity = String(active ? Math.max(charge * .95, cue.release)
        * (1 - smooth((age - CEREMONY.launch - .25) / .85)) : 0);
      tension.style.opacity = String(charge * .65 * (1 - exposure));
      white.style.opacity = String(exposure);
      white.dataset.exposure = exposure.toFixed(2);
    },
    dispose() { tension.remove(); light.remove(); white.remove(); },
  };
}
