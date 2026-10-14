import { smooth } from './ceremonyTimeline';

export const PRO_PACK_COUNT = 7;
export const packIndex = (index: number) => ((index % PRO_PACK_COUNT) + PRO_PACK_COUNT) % PRO_PACK_COUNT;
const wrap = (value: number, period: number) => ((value + period / 2) % period + period) % period - period / 2;

// Continuous position is separate from the selected pack, so browsing never
// swaps the pack under the pointer. Only user input starts a finite animation.
export function createProBoosterCarousel() {
  let position = 0, target = 0, focus = 0, focusTarget = 0;
  const turns = Array(PRO_PACK_COUNT).fill(0) as number[], turnTargets = [...turns];
  const approach = (from: number, to: number, step: number) => Math.abs(from - to) < .001 ? to : from + (to - from) * step;
  const turning = () => turns.some((value, index) => value !== turnTargets[index]);
  function faceFront() { turns.forEach((value, index) => { turnTargets[index] = value - wrap(value, Math.PI * 2); }); }
  return {
    get selected() { return packIndex(target); },
    get focused() { return focusTarget === 1; },
    get settled() { return focus === 1 && !turning() && position === target; },
    get moving() { return position !== target || turning() || focus !== focusTarget; },
    select(index: number) { if (focusTarget) return; faceFront(); target += wrap(index - packIndex(target), PRO_PACK_COUNT); },
    rotate(delta: number, animated = false) {
      if (focusTarget) return;
      const index = packIndex(target);
      if (animated) turnTargets[index] += delta;
      else { turns[index] += delta; turnTargets[index] = turns[index]; }
    },
    focus(value: boolean) { focusTarget = value ? 1 : 0; faceFront(); },
    advance(delta: number, reduced: boolean) {
      const step = reduced ? 1 : 1 - Math.exp(-delta * 9);
      position = approach(position, target, step); focus = approach(focus, focusTarget, step);
      turns.forEach((value, index) => { turns[index] = approach(value, turnTargets[index], step); });
    },
    pose(index: number) {
      return { distance: wrap(index - position, PRO_PACK_COUNT), focus: smooth(focus),
        rotation: turns[index], chosen: index === packIndex(target) };
    },
    reset() { position = target = focus = focusTarget = 0; turns.fill(0); turnTargets.fill(0); },
  };
}
