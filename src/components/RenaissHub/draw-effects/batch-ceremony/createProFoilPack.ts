import * as THREE from 'three';
import { foilGeometry, deformFoil } from './proBoosterGeometry';
import type { createProBoosterMaterials } from './proBoosterMaterials';

export function createProFoilPack(materials: ReturnType<typeof createProBoosterMaterials>) {
  const root = new THREE.Group(), strip = new THREE.Group(); root.add(strip);
  const skins = [false, true].flatMap(isStrip => [1, -1].map(side => {
    const geometry = foilGeometry(isStrip);
    // The reverse print must read correctly when the user turns the pouch over.
    if (side === -1) {
      const uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    }
    (isStrip ? strip : root).add(
      new THREE.Mesh(geometry, side === 1 ? materials.front : materials.back),
      new THREE.Mesh(geometry, side === 1 ? materials.insideFront : materials.insideBack));
    return { geometry, side, isStrip };
  }));
  let lastTear = -1, lastMouth = -1;
  return { root, strip,
    deform(tear: number, mouth: number) {
      if (tear === lastTear && mouth === lastMouth) return;
      skins.forEach(skin => deformFoil(skin.geometry, skin.side, tear, mouth, skin.isStrip));
      lastTear = tear; lastMouth = mouth;
    },
    dispose() { root.removeFromParent(); skins.forEach(skin => skin.geometry.dispose()); },
  };
}
