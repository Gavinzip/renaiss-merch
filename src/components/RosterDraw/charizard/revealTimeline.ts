import { PRIZE_BACK_Z, PRIZE_HOVER_Y } from './prizeStageLayout'

export const APPROACH_DURATION = 7.2
export const TURN_DURATION = 8.2
export const WINNER_REVEAL_TIME = 11.8
export const REVEAL_DURATION = 14.5

export const revealEase = (start: number, end: number, seconds: number) => {
  const t = Math.max(0, Math.min(1, (seconds - start) / (end - start)))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/** One clock drives the camera, physical lighting, atmosphere and editorial reveals. */
export function sampleReveal(seconds: number, reducedMotion = false) {
  const time = reducedMotion ? REVEAL_DURATION : Math.max(0, seconds)
  const approach = revealEase(1.6, APPROACH_DURATION, time)
  const turn = revealEase(2.8, TURN_DURATION, time)
  const handoff = revealEase(9.3, 11.7, time)
  const impact = reducedMotion ? 0 : Math.exp(-Math.pow((time - TURN_DURATION) / .48, 2))
  const settle = revealEase(8.7, 12.5, time)
  return {
    y: PRIZE_HOVER_Y + (reducedMotion ? 0 : Math.sin(Math.max(0, time - TURN_DURATION) * .75) * .025),
    z: PRIZE_BACK_Z * (1 - approach),
    approach,
    rotationY: .98 - turn * .70 + (reducedMotion ? 0 : Math.sin(Math.max(0, time - TURN_DURATION) * .28) * .025),
    rotationZ: 0,
    scale: 1,
    opacity: 1,
    light: .005 + revealEase(3.1, 7.4, time) * .995 + impact * .25,
    atmosphere: revealEase(0, 1.2, time) * (1 - settle * .5),
    fire: revealEase(.8, 4.5, time) * (1 - settle * .78) + impact * .6,
    impact,
    handoff,
    cameraPush: revealEase(1.8, 8.0, time),
    introOpacity: revealEase(.2, 1, time) * (1 - revealEase(2.0, 3.2, time)),
    titleOpacity: revealEase(5.8, 7.6, time) * (1 - revealEase(9.1, 10.3, time)),
    copyOpacity: revealEase(10, 11.7, time),
    winnerOpacity: revealEase(WINNER_REVEAL_TIME, 13.6, time),
    progress: Math.min(1, time / REVEAL_DURATION),
    phase: time < 2.2 ? 'charge' : time < APPROACH_DURATION ? 'emerge' : time < TURN_DURATION ? 'orbit' : time < 9.3 ? 'hero' : time < WINNER_REVEAL_TIME ? 'handoff' : time < REVEAL_DURATION ? 'reveal' : 'settled',
    winnerVisible: time >= WINNER_REVEAL_TIME,
    finished: time >= REVEAL_DURATION,
  }
}
