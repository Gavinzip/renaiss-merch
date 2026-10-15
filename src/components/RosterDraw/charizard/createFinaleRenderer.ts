import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { FinaleVolumePass } from './FinaleVolumePass'

/** Bloom is restricted to HDR highlights; typography remains crisp outside WebGL. */
export function createFinaleRenderer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  const composer = new EffectComposer(renderer)
  // Only the geometry pass needs depth and MSAA. Volume and Output swap twice,
  // so RenderPass always starts on this same scene target; the color composite
  // target needs neither multisampling nor a second depth allocation.
  const sceneTarget = composer.readBuffer
  sceneTarget.samples = Math.min(4, renderer.capabilities.maxSamples)
  sceneTarget.depthTexture = new THREE.DepthTexture(sceneTarget.width, sceneTarget.height, THREE.UnsignedIntType)
  composer.writeBuffer.depthBuffer = false
  const renderPass = new RenderPass(scene, camera)
  const volume = new FinaleVolumePass(camera)
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .2, .6, 2.2)
  const output = new OutputPass()
  composer.addPass(renderPass)
  composer.addPass(volume)
  composer.addPass(bloom)
  composer.addPass(output)
  return {
    render: () => composer.render(),
    warmup: () => {
      composer.renderToScreen = false
      try { composer.render(); composer.render() }
      finally { composer.renderToScreen = true }
    },
    getDiagnostics: () => ({ sceneSamples: sceneTarget.samples, maxSamples: renderer.capabilities.maxSamples }),
    update: (seconds: number, reducedMotion: boolean, portrait: boolean) => volume.update(seconds, reducedMotion, portrait),
    resize: (width: number, height: number) => { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(width, height) },
    dispose: () => { volume.dispose(); bloom.dispose(); output.dispose(); composer.dispose() },
  }
}
