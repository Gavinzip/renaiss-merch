import * as THREE from 'three';
import { PRO_PACK_VERTICAL_SCALE } from './proBoosterDimensions';
import { smooth } from './ceremonyTimeline';

// Split at the bottom of the printed crimp, where a physical pack opens.
// The old lower cut passed through the smooth face and left a visible band.
export const FOIL = { bottom: -.74, seam: .67, top: .74 };

export function foilGeometry(strip = false) {
  const geometry = new THREE.PlaneGeometry(1, 1, 144, strip ? 12 : 100);
  const uv = geometry.attributes.uv;
  geometry.setAttribute('shapeUv', uv.clone());
  for (let i = 0; i < uv.count; i++) {
    const y = strip ? FOIL.seam + uv.getY(i) * (FOIL.top - FOIL.seam)
      : FOIL.bottom + uv.getY(i) * (FOIL.seam - FOIL.bottom);
    uv.setY(i, (y - FOIL.bottom) / (FOIL.top - FOIL.bottom));
  }
  return geometry;
}

// Seams pinch both skins together. Wrinkles concentrate where the foil is
// compressed, leaving the printed centre gently inflated instead of corrugated.
function foilDepth(u: number, y: number) {
  const across = Math.max(0, Math.sin(Math.PI * u));
  const end = Math.min(1, Math.max(0, (y - FOIL.bottom) / .13));
  const top = Math.min(1, Math.max(0, (FOIL.top - y) / .14));
  const pillow = .079 * Math.pow(across, .5) * smooth(end) * smooth(top);
  const folds = Math.exp(-Math.pow((y - .572) / .056, 2))
    + .8 * Math.exp(-Math.pow((y + .667) / .048, 2));
  const wrinkle = (.0048 * Math.sin(u * 116 + y * 9 + Math.sin(u * 31))
    + .0018 * Math.sin(u * 191 - y * 20)) * folds * across;
  const sideCrease = .0015 * Math.sin(y * 52 + u * 14) * Math.pow(1 - across, 3);
  const seal = (y < -.675 || y > .681) ? .0025 * Math.cos(u * Math.PI * 144) : 0;
  return .0045 + pillow + wrinkle + sideCrease * end * top + seal;
}

function tornEdge(u: number) {
  return .0023 * Math.sin(u * 311) + .0012 * Math.sin(u * 701);
}

export function deformFoil(geometry: THREE.PlaneGeometry, side: number, tear: number, mouth: number, strip = false) {
  const positions = geometry.attributes.position, uv = geometry.attributes.shapeUv;
  for (let i = 0; i < positions.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    // The crack advances under the pointer. The material ahead of it stays
    // joined, while the already torn foil curls out of the pouch's plane.
    const released = smooth((tear - u) / .085);
    let x = u - .5;
    let y = strip ? FOIL.seam + v * (FOIL.top - FOIL.seam)
      : FOIL.bottom + v * (FOIL.seam - FOIL.bottom);
    let z = foilDepth(u, y) * side;
    if (strip) {
      const peeledLength = Math.max(0, tear - u);
      const curl = Math.sin(Math.min(1, peeledLength / .34) * Math.PI);
      x += released * (.035 * curl + peeledLength * .018);
      y += released * (.018 + peeledLength * .075 + tornEdge(u) * (1 - v));
      z += released * (.075 + curl * .19 + v * .045);
      if (v > .999) y += .003 * Math.cos(u * Math.PI * 144);
    } else {
      const lip = Math.pow(v, 13), across = Math.sin(Math.PI * u);
      z += side * mouth * .17 * across * lip;
      y -= mouth * (side === 1 ? .095 : -.038) * across * lip;
      y += tornEdge(u) * released * lip;
      if (v < .001) y += .003 * Math.cos(u * Math.PI * 144);
    }
    positions.setXYZ(i, x, y * PRO_PACK_VERTICAL_SCALE, z);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}
