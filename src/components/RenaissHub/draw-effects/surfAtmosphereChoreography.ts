import type { RevealPhase } from '../useSurfDrawPresentation';
import { boxOpening, boxExposure, boxCeremonyDuration } from './batch-ceremony/ceremonyTimeline';

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

// Presentation only. Real receipt timing, the six reel stops and the one-second
// ticket hold remain owned by the draw controller.
export function sampleSurfAtmosphere(phase: RevealPhase, stops: number, phaseAge: number, releaseAge: number | null, batch = false, boxBatch = false) {
  const moving = phase === 'spinning' || phase === 'settling';
  const releasing = releaseAge !== null && (phase === 'identity' || phase === 'revealed' || batch && (phase === 'settling' || phase === 'ticket'));
  const boxCharge = boxBatch && phase === 'settling'
    ? boxOpening(phaseAge).charge : 0;
  const gather = boxBatch && phase === 'settling' ? boxCharge : phase === 'spinning' ? 0 : stops / 6;
  const energy = phase === 'spinning' ? .12 + .88 * smooth(phaseAge / 3.9)
    : moving ? boxBatch && phase === 'settling' ? .7 + .3 * (1 - boxCharge) : 1 - gather * .94 : .035;
  const anticipation = phase === 'ticket' ? smooth(phaseAge / .85) : 0;
  // The climax follows the lid/credential opening, rather than flashing at the
  // first identity frame while the prize is still closed.
  const age = releaseAge ?? 0;
  // A single eased rise and fall follows the opening. It reaches an exact
  // resting value, rather than leaving an exponential glow after completion.
  const release = releasing ? boxBatch
    ? boxExposure(age).release
    : smooth(age / .85) * (1 - smooth((age - .85) / 2.55)) : 0;
  const expansion = releasing ? boxBatch ? boxExposure(age).expansion : smooth(age / 1.9) : 0;
  return {
    moving, releasing, energy, gather, anticipation, release, expansion,
    speed: moving ? boxBatch && phase === 'settling' ? .18 + release * 3 + (1 - boxCharge) * .25 : .28 + energy * 1.35 : releasing ? release * 17 : 0,
    run: moving || releasing && age < (boxBatch ? boxCeremonyDuration(7) : 3.6) || phase === 'ticket' && phaseAge < .95,
  };
}
