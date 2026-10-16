type SurfacePose = { rotation: number; pitch: number; tiltX: number; tiltY: number; lift: number };
const keys = ['rotation', 'pitch', 'tiltX', 'tiltY', 'lift'] as const;
const empty = (): SurfacePose => ({ rotation: 0, pitch: 0, tiltX: 0, tiltY: 0, lift: 0 });
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
const wrapTurn = (value: number) => ((value + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

/** Pointer-driven foil pose; the wheel position and prize result stay separate. */
export function createProBoosterSurfaceMotion(count: number) {
  const poses = Array.from({ length: count }, empty);
  const targets = Array.from({ length: count }, empty);
  const valid = (index: number) => Number.isInteger(index) && index >= 0 && index < count;
  return {
    get moving() { return poses.some((pose, index) => keys.some(key => pose[key] !== targets[index][key])); },
    hover(index: number | null, x = 0, y = 0) {
      targets.forEach((target, at) => {
        const over = at === index && Number.isFinite(x) && Number.isFinite(y);
        target.tiltX = over ? -clamp(y, 1) * .18 : 0;
        target.tiltY = over ? clamp(x, 1) * .26 : 0;
        target.lift = over ? 1 : 0;
      });
    },
    rotate(index: number, delta: number, animated = false, pitchDelta = 0) {
      if (!valid(index) || !Number.isFinite(delta) || !Number.isFinite(pitchDelta)) return;
      const target = targets[index];
      target.rotation = (animated ? target.rotation : poses[index].rotation) + delta;
      target.pitch = clamp((animated ? target.pitch : poses[index].pitch) + pitchDelta, .8);
      if (!animated) {
        poses[index].rotation = target.rotation;
        poses[index].pitch = target.pitch;
      }
    },
    faceFront() {
      targets.forEach((target, index) => {
        target.rotation = poses[index].rotation - wrapTurn(poses[index].rotation);
        target.pitch = target.tiltX = target.tiltY = target.lift = 0;
      });
    },
    advance(delta: number, reduced: boolean) {
      const step = reduced ? 1 : 1 - Math.exp(-delta * 12);
      poses.forEach((pose, index) => keys.forEach(key => {
        const target = targets[index][key];
        pose[key] = Math.abs(target - pose[key]) < .001 ? target : pose[key] + (target - pose[key]) * step;
      }));
    },
    pose(index: number) { return poses[index]; },
    reset() { poses.forEach(pose => Object.assign(pose, empty())); targets.forEach(target => Object.assign(target, empty())); },
  };
}
