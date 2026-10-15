import * as THREE from 'three'
import { atmosphereVertex, finaleNoise } from './finaleNoise'
import { PRIZE_GROUND_Y } from './prizeStageLayout'

/** Distant light falloff and the ground; actual smoke/fire live in FinaleVolumePass. */
export function createFinaleAtmosphere() {
  const group = new THREE.Group()
  const uniforms = { time: { value: 0 }, strength: { value: 0 }, fire: { value: 0 }, impact: { value: 0 } }
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(36, 21), new THREE.ShaderMaterial({
    uniforms, depthWrite: false, vertexShader: atmosphereVertex,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float time, strength, impact;
      void main() {
        vec2 p = (vUv - .5) * vec2(3.5, 2.);
        float mist = .4;
        float halo = exp(-dot(p * vec2(1.2, .9), p * vec2(1.2, .9)) * 2.5);
        float lower = exp(-pow((p.y + .45) * 2.4, 2.)) * exp(-p.x * p.x * 1.7);
        float shaft = pow(max(0., 1. - abs(p.x + p.y * .4 + .14)), 14.);
        vec3 color = vec3(.006, .008, .014);
        color += vec3(.035, .014, .009) * mist * halo * strength;
        color += vec3(.31, .18, .068) * shaft * mist * strength * .32;
        color += vec3(.04, .015, .009) * lower * strength * (.25 + impact * .45);
        color += vec3(.025, .04, .055) * mist * (1. - halo) * strength;
        gl_FragColor = vec4(color, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }))
  backdrop.position.set(0, 2, -11)
  backdrop.renderOrder = -3
  group.add(backdrop)

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, vertexShader: atmosphereVertex,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float time, strength, fire, impact;
      ${finaleNoise}
      void main() {
        vec2 p = (vUv - .5) * 8.;
        float grain = fbm(p * 2. + vec2(time * .018, 0.));
        float pool = exp(-dot(p, p) * .7);
        float hot = pow(grain, 3.) * pool;
        vec3 color = vec3(.2, .061, .02) * pool * strength;
        color += vec3(1.8, .51, .1) * hot * (fire + impact * .7);
        gl_FragColor = vec4(color, pool * .85);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, PRIZE_GROUND_Y - .01, 0)
  floor.renderOrder = -2
  group.add(floor)
  return { group, uniforms }
}
