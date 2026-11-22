import * as THREE from 'three';
import { foilGeometry, deformFoil } from './proBoosterGeometry';
import type { createProBoosterMaterials } from './proBoosterMaterials';
import { createFoilSeams } from './createFoilSeams';

export function createProFoilPack(materials: ReturnType<typeof createProBoosterMaterials>) {
  const root = new THREE.Group(), strip = new THREE.Group(); strip.name = 'foilStrip'; root.add(strip);
  const skins = [false, true].flatMap(isStrip => [1, -1].map(side => {
    const geometry = foilGeometry(isStrip);
    // The reverse print must read correctly when the user turns the pouch over.
    if (side === -1) {
      const uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    }
    const print = new THREE.Mesh(geometry, side === 1 ? materials.front : materials.back);
    const inside = new THREE.Mesh(geometry, side === 1 ? materials.insideFront : materials.insideBack);
    print.name = 'foilPrint'; inside.name = 'foilInterior';
    (isStrip ? strip : root).add(print, inside);
    return { geometry, side, isStrip };
  }));
  const seams = [false, true].map(isStrip => {
    const front = skins.find(skin => skin.isStrip === isStrip && skin.side === 1)!;
    const back = skins.find(skin => skin.isStrip === isStrip && skin.side === -1)!;
    const seam = createFoilSeams(front.geometry, back.geometry, isStrip);
    const mesh = new THREE.Mesh(seam.geometry, materials.seam); mesh.name = 'foilSeam';
    (isStrip ? strip : root).add(mesh);
    return seam;
  });
  let lastTear = -1, lastMouth = -1, lastLoose = -1;
  return { root, strip,
    deform(tear: number, mouth: number, loose = 0) {
      if (tear === lastTear && mouth === lastMouth && loose === lastLoose) return;
      skins.forEach(skin => deformFoil(skin.geometry, skin.side, tear, mouth, skin.isStrip, loose));
      seams.forEach(seam => seam.update());
      lastTear = tear; lastMouth = mouth; lastLoose = loose;
    },
    dispose() { root.removeFromParent(); skins.forEach(skin => skin.geometry.dispose()); seams.forEach(seam => seam.geometry.dispose()); },
  };
}
