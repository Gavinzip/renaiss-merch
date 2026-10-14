import { PRO_PACK_ASPECT, PRO_PACK_VERTICAL_SCALE } from './proBoosterDimensions';
import { clamp, smooth, out, type CeremonyLayout, type CardTarget } from './ceremonyTimeline';

// Cards travel as one physically fitted stack until its bottom clears the mouth.
// The landscape tickets are packed upright, then the whole stack turns to reading
// orientation before the first card leaves for the gallery.
export const PRO_BOOSTER = { tear: .30, unseal: 1.08, lift: 1.52, clear: 3.35, deal: 4.28, flight: .94, stagger: .115 };
export const proDealDuration = (count: number) => PRO_BOOSTER.deal + Math.max(0, count - 1) * PRO_BOOSTER.stagger + PRO_BOOSTER.flight;
export function proBoosterLayout(layout: CeremonyLayout) {
  // The pack controls live below the gallery or alongside the chosen pack.
  // Do not reserve their old 78px inside the gallery: that made the foil tiny
  // on a presentation-size viewport and hid the physical tear.
  const space = Math.max(160, layout.height - layout.safeTop - 12);
  const width = Math.min(286, layout.width * .58, space / (PRO_PACK_ASPECT + .04));
  return { x: layout.width / 2, y: layout.safeTop + space * .5, width, height: width * PRO_PACK_ASPECT };
}
export const proAgeForTear = (tear: number) => tear > 0 ? PRO_BOOSTER.tear + (PRO_BOOSTER.unseal - PRO_BOOSTER.tear) * (1 - Math.cbrt(1 - clamp(tear))) : 0;
export function proBoosterMotion(age: number) {
  const withdraw = smooth((age - 2.02) / 1.28);
  const drop = smooth((age - 3.35) / .82);
  return {
    load: smooth(age / PRO_BOOSTER.tear) * (1 - smooth((age - PRO_BOOSTER.tear) / .34)),
    tear: out((age - PRO_BOOSTER.tear) / (PRO_BOOSTER.unseal - PRO_BOOSTER.tear)),
    mouth: smooth((age - .96) / .48),
    sleeveY: .025 * smooth(age / .96) + 1.08 * PRO_PACK_VERTICAL_SCALE * withdraw + 5 * drop,
    drop, stripExit: smooth((age - 1.16) / .76),
  };
}
export function proCardFlight(age: number, index: number, target: CardTarget, layout: CeremonyLayout) {
  const source = proBoosterLayout(layout), count = layout.cards.length;
  const rise = smooth((age - PRO_BOOSTER.lift) / 1.55);
  const presented = smooth((age - PRO_BOOSTER.clear) / .82);
  const deal = smooth((age - PRO_BOOSTER.deal - index * PRO_BOOSTER.stagger) / PRO_BOOSTER.flight);
  const stackOffset = index * Math.min(1.8, 15 / count);
  const packedScale = Math.min(.76 * source.width / target.height, 1.22 * source.width / target.width);
  const readingScale = source.width * 1.22 / target.width;
  const stackScale = packedScale + (readingScale - packedScale) * presented;
  const x = source.x - stackOffset * .25 * presented;
  const y = source.y + source.width * (.045 - .625 * (PRO_PACK_VERTICAL_SCALE - 1) * (1 - presented) - .30 * rise + .04 * presented) + stackOffset * presented;
  const stackZ = 500 + (count - 1 - index) * (source.width * .0015 + presented * 4.8 * stackScale);
  const targetZ = 180 + (count - index) * Math.hypot(target.width, target.height);
  const arc = Math.sin(Math.PI * deal);
  return { progress: clamp((age - PRO_BOOSTER.lift) / .05),
    x: x + (target.x - x) * deal,
    y: y + (target.y - y) * deal - 34 * arc,
    z: stackZ + presented * 60 + (targetZ - stackZ - 60) * deal + 120 * arc,
    scale: stackScale + (1 - stackScale) * deal,
    depthScale: (source.width * .00032 / stackScale + .9 * presented) * (1 - deal) + deal,
    rx: .10 * arc,
    ry: Math.PI + .08 * arc * Math.sign(target.x - source.x),
    rz: Math.PI / 2 * (1 - presented) * (1 - deal) - .055 * arc * Math.sign(target.x - source.x),
  };
}
