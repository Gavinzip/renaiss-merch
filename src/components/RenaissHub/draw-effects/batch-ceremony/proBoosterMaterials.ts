import * as THREE from 'three';
import { canvasTexture, type CeremonyArtwork } from './ceremonyArtwork';
import { proBoosterArtwork } from './proBoosterArtwork';

// Long photographic softboxes and dark gaps illuminate only the foil. The
// bright page and Mystery Box keep their own existing lighting.
export function createProBoosterMaterials(renderer: THREE.WebGLRenderer, art: CeremonyArtwork) {
  const studio = new THREE.Scene(); studio.background = new THREE.Color('#555b60');
  const plane = new THREE.PlaneGeometry(1, 1);
  const lights: THREE.MeshBasicMaterial[] = [];
  for (const [position, size, intensity] of [
    [[-2.5, 1, 4], [2.2, 7, 1], 1.5],
    [[2.5, 1.5, 4], [1.6, 6, 1], 1.25],
    [[0, 4, 2], [6, 2.5, 1], 1.6],
    [[0, -3, 3], [5, 1.5, 1], .8],
    [[0, 0, -4], [5, 5, 1], 1.2],
  ] as const) {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide });
    lights.push(material);
    const light = new THREE.Mesh(plane, material);
    light.position.set(position[0], position[1], position[2]); light.scale.set(size[0], size[1], size[2]); light.lookAt(0, 0, 0); studio.add(light);
  }
  const pmrem = new THREE.PMREMGenerator(renderer), environment = pmrem.fromScene(studio, .035);
  pmrem.dispose(); plane.dispose(); lights.forEach(light => light.dispose());
  const frontTexture = canvasTexture(proBoosterArtwork(art));
  const backTexture = canvasTexture(proBoosterArtwork(art, true));
  const material = (map: THREE.Texture, side: THREE.Side) => new THREE.MeshPhysicalMaterial({
    map, side, metalness: .78, roughness: .27, clearcoat: .32, clearcoatRoughness: .24,
    envMap: environment.texture, envMapIntensity: .9,
  });
  const front = material(frontTexture, THREE.FrontSide), back = material(backTexture, THREE.BackSide);
  const insideFront = new THREE.MeshStandardMaterial({ color: '#bcc4c7', metalness: .85, roughness: .42,
    envMap: environment.texture, envMapIntensity: .8, side: THREE.BackSide });
  const insideBack = insideFront.clone(); insideBack.side = THREE.FrontSide;
  return { front, back, insideFront, insideBack,
    dispose() {
      front.dispose(); back.dispose(); insideFront.dispose(); insideBack.dispose();
      frontTexture.dispose(); backTexture.dispose(); environment.dispose();
    },
  };
}
