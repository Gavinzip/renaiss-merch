import * as THREE from 'three';
import { bloomVertex, bloomFragment } from './ceremonyBurstShaders';
import { CEREMONY, type CeremonyLayout } from './ceremonyTimeline';

export function createSurfCeremonyBurst(scene: THREE.Scene) {
  const count = 280, seed = (i: number) => { const n = Math.sin(i * 127.1 + 91.7) * 43758.5453; return n - Math.floor(n); };
  const seeds = new Float32Array(count * 4), kinds = new Float32Array(count);
  for (let i = 0; i < count; i++) { for (let j = 0; j < 4; j++) seeds[i * 4 + j] = seed(i * 4 + j); kinds[i] = i % 13 === 0 ? 2 : i % 5 === 0 ? 1 : 0; }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4)); geometry.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1));
  const material = new THREE.ShaderMaterial({ uniforms: { uAge: { value: -1 }, uPixelRatio: { value: 1.5 }, uExtent: { value: new THREE.Vector2() } },
    vertexShader: bloomVertex, fragmentShader: bloomFragment, transparent: true, depthTest: true, depthWrite: false, toneMapped: false });
  const bloom = new THREE.Points(geometry, material); bloom.frustumCulled = false; bloom.visible = false; scene.add(bloom);
  return {
    render(phase: string, age: number, layout: CeremonyLayout, ratio: number, reduced: boolean) {
      const t = age - CEREMONY.burst; bloom.visible = phase === 'settling' && !reduced && t >= 0 && t < 1.12;
      if (!bloom.visible) return;
      geometry.setDrawRange(0, layout.width < 700 ? 130 : count);
      bloom.position.set(layout.emitter.x - layout.width / 2, layout.height / 2 - layout.emitter.y, layout.emitter.z + 35);
      material.uniforms.uAge.value = t; material.uniforms.uPixelRatio.value = ratio;
      material.uniforms.uExtent.value.set(Math.min(layout.width * .36, layout.unit * 1.7), Math.min(layout.height * .32, layout.unit * 1.05));
    }, dispose() { scene.remove(bloom); geometry.dispose(); material.dispose(); },
  };
}
