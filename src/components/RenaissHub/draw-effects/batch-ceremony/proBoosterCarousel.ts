import { smooth } from './ceremonyTimeline';

export const PRO_PACK_COUNT = 7;
export const packIndex = (index: number) => ((index % PRO_PACK_COUNT) + PRO_PACK_COUNT) % PRO_PACK_COUNT;
const wrap = (value: number, period: number) => ((value + period / 2) % period + period) % period - period / 2;

/** Shared ellipse projection for the physical packs and their hit targets. */
export function packOrbit(distance: number) {
  const angle = distance * Math.PI * 2 / PRO_PACK_COUNT;
  const depth = (1 - Math.cos(angle)) / 2;
  return { x: Math.sin(angle) * 1.24, depth, scale: 1 / (1 + .65 * depth), lower: -.275 * depth };
}

// Continuous position is separate from the selected pack, so browsing never
// swaps the pack under the pointer. Only user input starts a finite animation.
export function createProBoosterCarousel() {
  let position = 0, target = 0, focus = 0, focusTarget = 0;
  let spin: { from: number; to: number; elapsed: number } | null = null;
  const turns = Array(PRO_PACK_COUNT).fill(0) as number[], turnTargets = [...turns];
  const approach = (from: number, to: number, step: number) => Math.abs(from - to) < .001 ? to : from + (to - from) * step;
  const turning = () => turns.some((value, index) => value !== turnTargets[index]);
  function faceFront() { turns.forEach((value, index) => { turnTargets[index] = value - wrap(value, Math.PI * 2); }); }
  return {
    get position() { return position; },
    get spinning() { return spin !== null; },
    get selected() { return packIndex(Math.round(target)); },
    get focused() { return focusTarget === 1; },
    get settled() { return focus === 1 && !turning() && position === target; },
    get moving() { return spin !== null || position !== target || turning() || focus !== focusTarget; },
    select(index: number) { if (focusTarget || spin) return; faceFront(); target += wrap(index - packIndex(target), PRO_PACK_COUNT); },
    browse(delta: number, settle: boolean) {
      if (focusTarget || spin) return this.selected;
      faceFront();
      if (settle) target = Math.round(position);
      else { position -= delta; target = position; }
      return this.selected;
    },
    rotate(delta: number, animated = false) {
      if (focusTarget || spin) return;
      const index = packIndex(Math.round(target));
      if (animated) turnTargets[index] += delta;
      else { turns[index] += delta; turnTargets[index] = turns[index]; }
    },
    spin() {
      if (focusTarget || spin) return;
      faceFront();
      // Presentation only: this landing pack never determines the server winner.
      target = Math.ceil(position) + PRO_PACK_COUNT * 2 + 1 + Math.floor(Math.random() * (PRO_PACK_COUNT - 1));
      spin = { from: position, to: target, elapsed: 0 };
    },
    focus(value: boolean) { if (spin) return; focusTarget = value ? 1 : 0; faceFront(); },
    advance(delta: number, reduced: boolean) {
      const step = reduced ? 1 : 1 - Math.exp(-delta * 9);
      if (spin) {
        spin.elapsed += delta;
        const t = reduced ? 1 : Math.min(1, spin.elapsed / 2);
        position = spin.from + (spin.to - spin.from) * (1 - (1 - t) ** 3);
        if (t === 1) { position = target; spin = null; }
      } else position = approach(position, target, step);
      focus = approach(focus, focusTarget, step);
      turns.forEach((value, index) => { turns[index] = approach(value, turnTargets[index], step); });
    },
    pose(index: number) {
      return { distance: wrap(index - position, PRO_PACK_COUNT), focus: smooth(focus),
        rotation: turns[index], chosen: index === packIndex(Math.round(target)) };
    },
    reset() { spin = null; position = target = focus = focusTarget = 0; turns.fill(0); turnTargets.fill(0); },
  };
}
