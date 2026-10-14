import * as THREE from 'three';

function dataTexture(data: Uint8Array, size: number, color = false) {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat); texture.needsUpdate = true;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 8;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function createFilmBoxMaterials() {
  // Reference statistics guide these de-lit channels. The source photograph is
  // never wrapped around the model: its highlights/emission would be baked in.
  const size = 1024, albedo = new Uint8Array(size * size * 4), rough = new Uint8Array(albedo.length), height = new Uint8Array(albedo.length), normal = new Uint8Array(albedo.length), ao = new Uint8Array(albedo.length);
  let seed = 7321; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  for (let y = 0; y < size; y++) {
    const line = (random() - .5) * 1.8;
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4, micro = random() - .5, meso = Math.sin(y * .7 + Math.sin(x * .009) * .13), broad = Math.sin(y * .017) * .8;
      const a = 62 + line + micro * 1.6 + broad;
      albedo.set([a, a - 1, a + 1, 255], i);
      const r = 150 + line * 4 + micro * 13 + meso * 3; rough.set([r, r, r, 255], i);
      const h = 128 + line * 12 + meso * 2 + micro * 3; height.set([h, h, h, 255], i);
      normal.set([128 + micro, 128 + Math.cos(y * .7) * 3 + line * 1.6, 255, 255], i);
      // Independent restrained panel-edge occlusion; broad cavities are geometry.
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y), o = 255 - 30 * Math.exp(-edge / 12); ao.set([o, o, o, 255], i);
    }
  }
  const maps = { albedo: dataTexture(albedo, size, true), roughness: dataTexture(rough, size), height: dataTexture(height, size), normal: dataTexture(normal, size), ao: dataTexture(ao, size) };
  const graphite = new THREE.MeshPhysicalMaterial({ map: maps.albedo, color: '#ffffff', metalness: .7, roughness: .85, roughnessMap: maps.roughness, bumpMap: maps.height, bumpScale: .00015, normalMap: maps.normal, normalScale: new THREE.Vector2(.35,.35), aoMap: maps.ao, aoMapIntensity: .18, anisotropy: .45, anisotropyRotation: 0, clearcoat: .12, clearcoatRoughness: .42 });
  const chrome = new THREE.MeshPhysicalMaterial({ color: '#a4a7ac', metalness: 1, roughness: .32, roughnessMap: maps.roughness, clearcoat: .3, clearcoatRoughness: .17 });
  const lining = new THREE.MeshStandardMaterial({ color: '#13141a', metalness: .12, roughness: .75 });
  const fastener = new THREE.MeshPhysicalMaterial({ color: '#34343b', metalness: .95, roughness: .23 });
  const channel = new THREE.MeshStandardMaterial({ color: '#221b28', metalness: .8, roughness: .28 });
  const light = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ff007b', emissiveIntensity: 1.0, toneMapped: false, roughness: .22, metalness: .18 });
  const core = new THREE.MeshBasicMaterial({ color: '#ffd8f0', toneMapped: false });
  const all = [graphite, chrome, lining, fastener, channel, light, core];
  return { graphite, chrome, lining, fastener, channel, light, core, all, maps, dispose() { all.forEach(m => m.dispose()); Object.values(maps).forEach(t => t.dispose()); } };
}
