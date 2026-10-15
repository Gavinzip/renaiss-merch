export const ENTRANCE_DURATION = 1450
export const ENTRANCE_BLEND_DURATION = 320

const EXPONENT = 9
const CAMERA_DISTANCE = 1000
const BLEND_START = 1 - ENTRANCE_BLEND_DURATION / ENTRANCE_DURATION

/** Keep accelerating through the cut into the scene; no ease-out at the threshold. */
export function entranceProgress(time) {
  const t = Math.max(0, Math.min(1, time))
  return Math.expm1(EXPONENT * t) / Math.expm1(EXPONENT)
}

const smooth = (start, end, time) => {
  const t = Math.max(0, Math.min(1, (time - start) / (end - start)))
  return t * t * (3 - 2 * t)
}

/** Combine camera approach and independent button expansion on one exponential clock. */
export function createEntranceMotion(origin, width, height) {
  // Share the enlargement between camera and surface, leaving room to see both motions.
  const endScale = Math.min(8, Math.max(4, width / origin.width))
  const expandedSize = Math.max(1.8 * origin.width / width, 1.8 * origin.height / height, 1.8 / endScale)
  const endButtonX = width * expandedSize / origin.width
  const endButtonY = height * expandedSize / origin.height
  const dx = width / 2 - (origin.x + origin.width / 2)
  const dy = height / 2 - (origin.y + origin.height / 2)
  const samples = Array.from({ length: 121 }, (_, index) => {
    const offset = index / 120
    const progress = entranceProgress(offset)
    const scale = 1 + (endScale - 1) * progress
    const buttonX = 1 + (endButtonX - 1) * progress
    const buttonY = 1 + (endButtonY - 1) * progress
    // Aim at the control early; its center reaches the viewport center as we enter it.
    const travel = (1 - 1 / scale) / (1 - 1 / endScale)
    return { offset, scale, buttonX, buttonY, x: dx * travel, y: dy * travel }
  })
  return {
    // Samples already contain the nonlinear motion; no second easing is applied.
    timing: { duration: ENTRANCE_DURATION, easing: 'linear', fill: 'both' },
    // Move a composited page toward the camera instead of repeatedly rasterizing
    // its long surface during nested scale animations. d / (d - z) equals scale.
    page: samples.map(({ offset, scale, x, y }) => ({
      offset,
      transformOrigin: `${origin.focalX}px ${origin.focalY}px`,
      transform: `translate3d(${x}px, ${y}px, 0) perspective(${CAMERA_DISTANCE}px) translateZ(${CAMERA_DISTANCE * (1 - 1 / scale)}px)`,
    })),
    // A transformed ancestor changes fixed positioning. Pin the header to its
    // current page coordinates so it travels with the page without a first-frame jump.
    header: [0, 1].map((offset) => ({ offset, position: 'absolute', top: `${origin.headerTop}px` })),
    button: samples.map(({ offset, buttonX, buttonY }) => ({
      offset,
      position: 'relative', zIndex: 30,
      transformOrigin: '50% 50%',
      transform: `${origin.transform} scale(${buttonX}, ${buttonY})`,
      // Preserve round corners while the surface changes aspect ratio.
      borderRadius: `${origin.radius / buttonX}px / ${origin.radius / buttonY}px`,
    })),
    unclipped: [{ overflow: 'visible' }, { overflow: 'visible' }],
    // Lower the gold luminance just before the scene appears, then overlap both
    // surfaces for a visible, fast dissolve instead of a bright-to-black cut.
    tone: samples.map(({ offset }) => ({
      offset,
      filter: `brightness(${1 - .66 * smooth(BLEND_START - .04, 1, offset)})`,
    })),
    label: [
      { offset: 0, color: origin.color, borderColor: origin.borderColor },
      { offset: .22, color: origin.color, borderColor: origin.borderColor },
      { offset: .56, color: 'transparent', borderColor: 'transparent' },
      { offset: 1, color: 'transparent', borderColor: 'transparent' },
    ],
    scene: samples.map(({ offset }) => ({ offset, opacity: smooth(BLEND_START, 1, offset) })),
  }
}
