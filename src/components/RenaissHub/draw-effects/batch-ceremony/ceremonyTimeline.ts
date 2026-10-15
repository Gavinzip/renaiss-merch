// Finite release paths for Mystery Boxes.
// The contract/presentation controller remains the only owner of winners.
export const CEREMONY = {
  chargeStart: .10, chargePeak: 1.62,
  sealBreak: 1.65, sealBreakEnd: 2.04, releaseEnd: 2.28, lidRest: 2.62,
  burst: 2.14, whiteHoldEnd: 2.54, whiteFadeEnd: 3.24,
  pullback: 2.20, pullbackEnd: 2.48,
  launch: 2.78, flight: 1.7, stagger: .045,
  boxRetreat: .9,
};
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const out = (n: number) => 1 - (1 - clamp(n)) ** 3;
export const dealDuration = (count: number) => CEREMONY.launch + (count - 1) * CEREMONY.stagger + CEREMONY.flight;
// The box holds its open pose until the final card has reached the grid.
export const boxRetreatAt = (count: number) => dealDuration(Math.max(1, count)) + .16;
export const boxCeremonyDuration = (count: number) => boxRetreatAt(count) + CEREMONY.boxRetreat;
export type CardTarget = { x: number; y: number; width: number; height: number };
export type CeremonyLayout = { width: number; height: number; safeTop: number; safeBottom: number; emitter: { x: number; y: number; z: number }; center: { x: number; y: number }; unit: number; cards: CardTarget[] };

export function boxOpening(age: number) {
  const charge = smooth((age - CEREMONY.chargeStart) / (CEREMONY.chargePeak - CEREMONY.chargeStart))
    * (1 - smooth((age - CEREMONY.sealBreakEnd) / .20));
  const pre = smooth((age - CEREMONY.sealBreak) / (CEREMONY.sealBreakEnd - CEREMONY.sealBreak));
  const release = out((age - CEREMONY.sealBreakEnd) / (CEREMONY.releaseEnd - CEREMONY.sealBreakEnd));
  const rest = smooth((age - CEREMONY.releaseEnd) / (CEREMONY.lidRest - CEREMONY.releaseEnd));
  // The seal resists first. A fast overshoot and a single counter-reaction make
  // the release feel mechanical; there is no repeating shake after it opens.
  const lid = pre * .065 + release * (1.12 - .065) - rest * .12;
  const kick = smooth((age - CEREMONY.sealBreakEnd) / .09)
    * (1 - smooth((age - CEREMONY.sealBreakEnd - .09) / .38));
  // Reframe only inside the opaque exposure, never while the box is charging.
  return { lid, kick, charge, pullback: smooth((age - CEREMONY.pullback) / (CEREMONY.pullbackEnd - CEREMONY.pullback)) };
}

export function boxExposure(age: number) {
  const attack = smooth((age - CEREMONY.burst + .10) / .10);
  const fade = 1 - smooth((age - CEREMONY.whiteHoldEnd) / (CEREMONY.whiteFadeEnd - CEREMONY.whiteHoldEnd));
  return {
    white: attack * fade,
    expansion: out((age - CEREMONY.sealBreakEnd) / .20),
    release: smooth((age - CEREMONY.sealBreakEnd) / .24) * (1 - smooth((age - CEREMONY.launch - .4) / 1.8)),
  };
}
// The mystery-box cards leave as one physical stack. The stack clears the rim
// before it fans out; only the final deal is staggered. Their printed size is
// already close to the box opening, so there is no tiny-to-full-size pop.
export function boxCardFlight(age: number, index: number, target: CardTarget, layout: CeremonyLayout) {
  const elapsed = age - CEREMONY.launch;
  const progress = clamp(elapsed / (CEREMONY.flight + index * CEREMONY.stagger));
  const rise = smooth(elapsed / .42);
  const spread = smooth((elapsed - .36) / .52);
  const deal = smooth((elapsed - .88 - index * CEREMONY.stagger) / .82);
  const source = layout.emitter;
  const fan = (index - (layout.cards.length - 1) / 2) / Math.max(1, layout.cards.length - 1);
  const stackX = source.x + (index - (layout.cards.length - 1) / 2) * 1.4;
  const stackY = source.y - index * .7;
  const liftY = stackY - layout.unit * .34 * rise;
  const fanX = source.x + fan * Math.min(layout.unit * 2.0, layout.width * .58);
  const fanY = stackY - layout.unit * (.34 + .1 * (1 - Math.abs(fan) * 2));
  const beforeDealX = stackX + (fanX - stackX) * spread;
  const beforeDealY = liftY + (fanY - liftY) * spread;
  const q = 1 - deal;
  const bezier = (a: number, b: number, c: number, d: number) => q*q*q*a + 3*q*q*deal*b + 3*q*deal*deal*c + deal*deal*deal*d;
  const targetZ = 180 + (layout.cards.length - index) * Math.hypot(target.width, target.height);
  const stackZ = source.z + (layout.cards.length - index) * 4.5;
  const fanZ = source.z + (targetZ - source.z) * .73;
  return {
    progress,
    x: bezier(beforeDealX, fanX + fan * layout.unit * .28, target.x + fan * layout.unit * .12, target.x),
    y: bezier(beforeDealY, fanY - layout.unit * .16, target.y - layout.unit * .09, target.y),
    z: stackZ + (fanZ - stackZ) * spread + (targetZ - fanZ) * deal,
    scale: .59 + .08 * rise + .13 * spread + .2 * deal,
    rx: -.48 * (1 - spread) - .055 * Math.sin(Math.PI * deal),
    ry: Math.PI + fan * .18 * spread * (1 - deal),
    rz: -fan * .55 * spread * (1 - deal),
  };
}
