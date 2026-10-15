import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { createVolumeNoise } from './createVolumeNoise'
import { volumeVertex, volumeFragment } from './finaleVolumeShader'
import { PRIZE_GROUND_Y } from './prizeStageLayout'
import { sampleReveal, REVEAL_DURATION } from './revealTimeline'

/** The volume has its own resolution budget; depth-aware upsampling keeps product edges crisp. */
export class FinaleVolumePass extends Pass {
  private camera: THREE.PerspectiveCamera
  private noise = createVolumeNoise()
  private target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false })
  private volume: THREE.ShaderMaterial
  private composite: THREE.ShaderMaterial
  private volumeQuad: FullScreenQuad
  private compositeQuad: FullScreenQuad
  constructor(camera: THREE.PerspectiveCamera) {
    super()
    this.camera = camera
    this.volume = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tDepth: { value: null }, tNoise: { value: this.noise },
        inverseProjection: { value: camera.projectionMatrixInverse }, cameraWorld: { value: camera.matrixWorld },
        eye: { value: new THREE.Vector3() }, time: { value: 0 }, strength: { value: 0 },
        firePower: { value: 0 }, emergence: { value: 0 }, impact: { value: 0 }, ground: { value: PRIZE_GROUND_Y },
        prizeCenter: { value: new THREE.Vector3() }, prizeRotation: { value: 0 },
        copyProtection: { value: 0 },
      },
      vertexShader: volumeVertex, fragmentShader: volumeFragment, depthTest: false, depthWrite: false,
    })
    this.composite = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tDiffuse: { value: null }, tVolume: { value: this.target.texture }, tDepth: { value: null },
        volumeSize: { value: new THREE.Vector2(1, 1) }, nearFar: { value: new THREE.Vector2(camera.near, camera.far) },
      },
      vertexShader: volumeVertex,
      fragmentShader: /* glsl */ `
        in vec2 vUv; out vec4 outColor;
        uniform sampler2D tDiffuse, tVolume, tDepth;
        uniform vec2 volumeSize, nearFar;
        float viewDepth(vec2 uv) {
          float d = texture(tDepth, uv).r;
          return nearFar.x * nearFar.y / (nearFar.y - d * (nearFar.y - nearFar.x));
        }
        void main() {
          vec2 pixel = vUv * volumeSize - .5;
          vec2 base = (floor(pixel) + .5) / volumeSize;
          vec2 f = fract(pixel);
          float depth = viewDepth(vUv);
          vec4 mist = vec4(0.); float total = 0.;
          for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) {
            vec2 uv = base + vec2(float(x), float(y)) / volumeSize;
            float area = (x == 0 ? 1. - f.x : f.x) * (y == 0 ? 1. - f.y : f.y);
            float weight = area * (.001 + exp(-abs(viewDepth(uv) - depth) * 3.));
            mist += texture(tVolume, uv) * weight; total += weight;
          }
          mist /= max(total, .00001);
          vec4 source = texture(tDiffuse, vUv);
          outColor = vec4(source.rgb * mist.a + mist.rgb, source.a);
        }`,
      depthTest: false, depthWrite: false,
    })
    this.volumeQuad = new FullScreenQuad(this.volume)
    this.compositeQuad = new FullScreenQuad(this.composite)
  }
  update(seconds: number, reducedMotion: boolean, portrait: boolean) {
    const time = reducedMotion ? REVEAL_DURATION : seconds
    const pose = sampleReveal(time, reducedMotion)
    const uniforms = this.volume.uniforms
    uniforms.time.value = time
    uniforms.strength.value = pose.atmosphere
    uniforms.firePower.value = pose.fire
    uniforms.emergence.value = pose.approach
    uniforms.impact.value = pose.impact
    uniforms.prizeCenter.value.set(0, pose.y, pose.z)
    uniforms.prizeRotation.value = pose.rotationY
    uniforms.copyProtection.value = portrait ? 0 : pose.handoff
  }
  setSize(width: number, height: number) {
    // The smoke's bandwidth is independent of the sharp, multisampled product image.
    const ratio = Math.min(.5, 440 / height, Math.sqrt(320_000 / (width * height)))
    const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio))
    this.target.setSize(w, h)
    this.composite.uniforms.volumeSize.value.set(w, h)
  }
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    this.volume.uniforms.tDepth.value = readBuffer.depthTexture
    this.volume.uniforms.eye.value.setFromMatrixPosition(this.camera.matrixWorld)
    renderer.setRenderTarget(this.target)
    this.volumeQuad.render(renderer)
    this.composite.uniforms.tDiffuse.value = readBuffer.texture
    this.composite.uniforms.tDepth.value = readBuffer.depthTexture
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this.compositeQuad.render(renderer)
  }
  dispose() {
    this.noise.dispose(); this.target.dispose()
    this.volume.dispose(); this.composite.dispose()
    this.volumeQuad.dispose(); this.compositeQuad.dispose()
  }
}
