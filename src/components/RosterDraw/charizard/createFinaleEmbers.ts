import * as THREE from 'three'
import { TURN_DURATION } from './revealTimeline'

/** Deterministic visual seeds only; independent of tickets and winner selection. */
export function createFinaleEmbers() {
  const seeds = new Float32Array(1000 * 3)
  for (let i = 0; i < seeds.length; i++) seeds[i] = ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3))
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, strength: { value: 0 }, burstAt: { value: TURN_DURATION }, pixelRatio: { value: 1.5 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float time, burstAt, pixelRatio;
      varying float alpha, heat, elongation;
      void main() {
        float angle = position.x * 6.283185;
        float speed = .2 + position.z * .8;
        float life = fract(position.y + time * speed * .09);
        float radius = 1.3 + position.z * 4.;
        vec3 point = vec3(cos(angle) * radius, life * 8. - 2., sin(angle) * radius - 1.7);
        point.x += sin(life * 5. + angle) * life * .7;
        alpha = sin(life * 3.14159) * (.2 + position.z * .8);
        // A separate cohort erupts once; gravity and drag bring the burst back down.
        float burst = max(0., time - burstAt);
        if (position.y > .7) {
          float travel = (1. - exp(-burst * .85)) * (3. + position.z * 4.);
          point = vec3(cos(angle) * (1.5 + travel), -1.5 + burst * (3. + position.z * 3.) - burst * burst * .85, sin(angle) * (1.5 + travel) - 1.5);
          alpha = step(burstAt, time) * exp(-burst * .7) * (1. - smoothstep(2., 4., burst));
        }
        heat = position.z;
        elongation = .7 + position.z * 1.9;
        vec4 viewPoint = modelViewMatrix * vec4(point, 1.);
        gl_Position = projectionMatrix * viewPoint;
        gl_PointSize = clamp((9. + pow(position.z, 6.) * 95.) * pixelRatio / -viewPoint.z, 1., 20.);
      }`,
    fragmentShader: /* glsl */ `
      uniform float strength;
      varying float alpha, heat, elongation;
      void main() {
        vec2 p = gl_PointCoord - .5;
        p.x *= elongation;
        float glow = exp(-dot(p, p) * 26.);
        float core = exp(-dot(p, p) * 180.);
        vec3 color = mix(vec3(1., .18, .012), vec3(2.2, 1.4, .45), heat);
        gl_FragColor = vec4(color, (glow * .35 + core) * alpha * strength);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  return { points, uniforms: material.uniforms }
}
