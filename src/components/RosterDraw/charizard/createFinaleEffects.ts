import * as THREE from 'three'
import { createFinaleAtmosphere } from './createFinaleAtmosphere'
import { createFinaleEmbers } from './createFinaleEmbers'
import { sampleReveal, REVEAL_DURATION } from './revealTimeline'

export function createFinaleEffects() {
  const group = new THREE.Group()
  const atmosphere = createFinaleAtmosphere()
  const embers = createFinaleEmbers()
  group.add(atmosphere.group, embers.points)
  return {
    group,
    update(seconds: number, reducedMotion: boolean, pixelRatio: number) {
      const time = reducedMotion ? REVEAL_DURATION : seconds
      const pose = sampleReveal(time, reducedMotion)
      atmosphere.uniforms.time.value = time
      atmosphere.uniforms.strength.value = pose.atmosphere
      atmosphere.uniforms.fire.value = pose.fire
      atmosphere.uniforms.impact.value = pose.impact
      embers.uniforms.time.value = time
      embers.uniforms.strength.value = pose.atmosphere * .85 + pose.impact * .6
      embers.uniforms.pixelRatio.value = pixelRatio
    },
  }
}
