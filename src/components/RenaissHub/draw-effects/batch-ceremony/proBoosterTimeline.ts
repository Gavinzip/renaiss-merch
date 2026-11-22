import { PRO_PACK_ASPECT, PRO_PACK_VERTICAL_SCALE } from './proBoosterDimensions';
import { clamp, smooth, out, type CeremonyLayout, type CardTarget } from './ceremonyTimeline';

// Cards travel as one physically fitted stack until its bottom clears the mouth.
// The landscape tickets are packed upright, then the whole stack turns to reading
// orientation before the first card leaves for the gallery.
export const PRO_TEAR_FINISH_AT = .9;
export const PRO_BOOSTER = { tear: .30, unseal: 1.08, lift: 1.52, clear: 3.35, turn: .32, deal: 3.72, flight: .94, stagger: .115 };
export const proDealDuration = (count: number) => PRO_BOOSTER.deal + Math.max(0, count - 1) * PRO_BOOSTER.stagger + PRO_BOOSTER.flight;
export function proBoosterLayout(layout: CeremonyLayout) {
  // A single fixed display stand can explicitly own its centre. Legacy batch
  // galleries retain their established available-space contract.
  const y = layout.viewportCenterY;
  const space = y === undefined ? Math.max(160, layout.height - layout.safeTop - layout.safeBottom - 12)
    : Math.max(160, 2 * Math.min(y - layout.safeTop - 10, layout.height - layout.safeBottom - y - 12));
  const width = Math.min(330, layout.width * .58, space / (PRO_PACK_ASPECT + .04) * 1.15);
  return { x: layout.width / 2, y: y ?? layout.safeTop + space * .5, width, height: width * PRO_PACK_ASPECT };
}
export const proAgeForTear = (tear: number) => tear > 0 ? PRO_BOOSTER.tear + (PRO_BOOSTER.unseal - PRO_BOOSTER.tear) * (1 - Math.cbrt(1 - clamp(tear))) : 0;
export function proBoosterMotion(age: number) {
  const withdraw = smooth((age - 2.02) / 1.28);
  const drop = smooth((age - 3.35) / .82);
  return {
    load: smooth(age / PRO_BOOSTER.tear) * (1 - smooth((age - PRO_BOOSTER.tear) / .34)),
    tear: out((age - PRO_BOOSTER.tear) / (PRO_BOOSTER.unseal - PRO_BOOSTER.tear)),
    mouth: smooth((age - PRO_BOOSTER.unseal) / .40),
    sleeveY: .025 * smooth(age / .96) + 1.08 * PRO_PACK_VERTICAL_SCALE * withdraw,
    withdraw, drop, stripExit: smooth((age - 1.16) / .88),
  };
}
// Four.meme's createSingleFoilBooster release contract, in CSS-pixel space.
// Withdraw the full pouch before card presentation, then let it fall completely
// beyond the drawing surface. A single card needs the same cavity clearance.
export function proBoosterReleaseOffset(pack: { y: number; width: number; height: number },
  motion: ReturnType<typeof proBoosterMotion>, drawingBottom: number) {
  const fallDistance = Math.max(5 * pack.width, drawingBottom + pack.height / 2 + 2 - pack.y);
  return motion.sleeveY * pack.width + fallDistance * motion.drop;
}

export function proCardFlight(age: number, index: number, target: CardTarget, layout: CeremonyLayout) {
  const source = proBoosterLayout(layout), count = layout.cards.length;
  const rise = smooth((age - PRO_BOOSTER.lift) / 1.55);
  const presented = smooth((age - PRO_BOOSTER.clear) / PRO_BOOSTER.turn);
  const deal = smooth((age - PRO_BOOSTER.deal - index * PRO_BOOSTER.stagger) / PRO_BOOSTER.flight);
  const stackOffset = index * Math.min(1.8, 15 / count);
  const packedScale = Math.min(.76 * source.width / target.height, 1.22 * source.width / target.width);
  const readingScale = source.width * 1.22 / target.width;
  const stackScale = packedScale + (readingScale - packedScale) * presented;
  const x = source.x - stackOffset * .25 * presented;
  const y = source.y + source.width * (.045 - .625 * (PRO_PACK_VERTICAL_SCALE - 1) * (1 - presented) - .30 * rise + .04 * presented) + stackOffset * presented;
  // Centre the packed stack inside the foil cavity. Growing all twenty layers
  // toward its front makes their corners puncture a thinner foil skin.
  const packedDepth = source.width * .0015;
  const stackZ = 500 + (count - 1 - index) * (packedDepth + presented * 4.8 * stackScale)
    - (1 - presented) * (count - 1) * packedDepth / 2;
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

// The single reward card and the loose foil can rise above a short 4:3 stage.
// Reserve drawing space above it without moving the pack or changing the flight.
export function proCanvasTopPadding(layout: CeremonyLayout) {
  const source = proBoosterLayout(layout);
  // The torn crimp lifts by at most about .14 pack widths before it detaches.
  let highest = source.y - source.width * (PRO_PACK_ASPECT / 2 + .14);
  const duration = proDealDuration(layout.cards.length);
  for (let age = PRO_BOOSTER.lift; age <= duration + .08; age += .08) {
    layout.cards.forEach((target, index) => {
      const pose = proCardFlight(age, index, target, layout);
      if (pose.progress <= 0) return;
      const verticalHalf = pose.scale * (
        Math.abs(Math.sin(pose.rz)) * target.width + Math.abs(Math.cos(pose.rz)) * target.height
      ) / 2 + 8;
      highest = Math.min(highest, pose.y - verticalHalf);
    });
  }
  return Math.max(0, Math.ceil(20 - highest));
}
