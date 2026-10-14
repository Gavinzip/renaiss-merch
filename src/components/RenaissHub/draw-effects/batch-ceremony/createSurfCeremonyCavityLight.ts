import * as THREE from 'three';
import { FILM_BOX } from '../film-box/filmBoxDesign';
import { CEREMONY, boxOpening, boxRetreatAt, clamp, smooth } from './ceremonyTimeline';

// The source stays in the hollow box. The front wall occludes the lower part
// of each veil, so the light reads as something inside the prop rather than a
// screen-space flare pasted over it. Every intensity follows the finite deal.
export function createSurfCeremonyCavityLight(root: THREE.Group) {
  const shaftMaterial = new THREE.ShaderMaterial({
    uniforms: { uStrength: { value: 0 }, uWarmth: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
    `,
    fragmentShader: /* glsl */`
      uniform float uStrength, uWarmth;
      varying vec2 vUv;
      void main() {
        float width = pow(max(0., 1. - abs(vUv.x - .5) * 2.), 2.4);
        float foot = smoothstep(0., .12, vUv.y);
        float crown = 1. - smoothstep(.24, 1., vUv.y);
        float alpha = width * foot * crown * uStrength * .55;
        if (alpha < .002) discard;
        vec3 pearl = mix(vec3(.91, .96, 1.), vec3(1., .965, .88), uWarmth);
        gl_FragColor = vec4(pearl, alpha);
      }
    `,
    transparent: true, depthTest: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  });
  const shaftGeometry = new THREE.PlaneGeometry(1, 1);
  const veils = new THREE.Group(); veils.name = 'cavity.lightVeils'; root.add(veils);
  for (const [x, z, width, height, angle] of [
    [-.31, -.12, .63, 1.28, -.31], [0, .02, .79, 1.62, 0], [.34, -.08, .57, 1.38, .29],
  ]) {
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
    shaft.position.set(x, FILM_BOX.baseHeight + height * .43, z);
    shaft.scale.set(width, height, 1);
    shaft.rotation.y = angle;
    veils.add(shaft);
  }
  const poolMaterial = new THREE.ShaderMaterial({
    uniforms: { uStrength: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
    `,
    fragmentShader: /* glsl */`
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - .5) * vec2(1.18, 1.);
        float core = exp(-dot(p, p) * 21.);
        float halo = exp(-dot(p, p) * 5.);
        float alpha = (core * 1.15 + halo * .34) * uStrength;
        if (alpha < .002) discard;
        gl_FragColor = vec4(1., .98, .92, alpha);
      }
    `,
    transparent: true, depthTest: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  });
  const poolGeometry = new THREE.PlaneGeometry(1.47, .88);
  const pool = new THREE.Mesh(poolGeometry, poolMaterial);
  pool.name = 'cavity.lightPool';
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, FILM_BOX.baseHeight + .006, 0);
  root.add(pool);
  const sealGeometry = new THREE.PlaneGeometry(FILM_BOX.width - .22, .016);
  const sealMaterial = new THREE.MeshBasicMaterial({ color: '#fff7eb', transparent: true,
    opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const seal = new THREE.Mesh(sealGeometry, sealMaterial);
  seal.name = 'cavity.chargedSeal';
  seal.position.set(0, FILM_BOX.baseHeight + FILM_BOX.seam * .5, FILM_BOX.depth / 2 + .055);
  const sealHaloGeometry = new THREE.PlaneGeometry(FILM_BOX.width - .12, .16);
  const sealHaloMaterial = new THREE.ShaderMaterial({
    uniforms: { uStrength: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */`
      uniform float uStrength; varying vec2 vUv;
      void main() {
        float core = exp(-pow((vUv.y - .5) * 7., 2.));
        float ends = smoothstep(0., .12, vUv.x) * (1. - smoothstep(.88, 1., vUv.x));
        gl_FragColor = vec4(1., .96, .86, core * ends * uStrength * .42);
      }
    `,
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const sealHalo = new THREE.Mesh(sealHaloGeometry, sealHaloMaterial);
  sealHalo.name = 'cavity.chargedSealHalo';
  sealHalo.position.copy(seal.position); sealHalo.position.z -= .002;
  root.add(sealHalo, seal);

  return {
    render(phase: string, age: number, count: number, reduced: boolean) {
      const active = phase === 'settling' && !reduced;
      const motion = boxOpening(age);
      const open = active ? smooth((motion.lid - .08) / .57) : 0;
      const retreat = smooth((age - boxRetreatAt(count)) / CEREMONY.boxRetreat);
      const launch = smooth((age - CEREMONY.launch) / .55);
      const strength = clamp(open * (1 - retreat) * (1 - launch * .48));
      poolMaterial.uniforms.uStrength.value = strength;
      shaftMaterial.uniforms.uStrength.value = strength;
      shaftMaterial.uniforms.uWarmth.value = smooth((age - CEREMONY.sealBreakEnd) / .7);
      pool.visible = veils.visible = strength > .005;
      const sealCharge = active ? motion.charge * (1 - smooth((age - CEREMONY.sealBreakEnd) / .22)) : 0;
      sealMaterial.opacity = sealCharge;
      sealHaloMaterial.uniforms.uStrength.value = sealCharge;
      seal.visible = sealHalo.visible = sealCharge > .005;
    },
    dispose() {
      root.remove(pool, veils, seal, sealHalo);
      poolGeometry.dispose(); poolMaterial.dispose(); shaftGeometry.dispose(); shaftMaterial.dispose();
      sealGeometry.dispose(); sealMaterial.dispose(); sealHaloGeometry.dispose(); sealHaloMaterial.dispose();
    },
  };
}
