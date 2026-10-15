import * as THREE from 'three';
import { PRO_PACK_VERTICAL_SCALE } from './proBoosterDimensions';
import { smooth } from './ceremonyTimeline';

// The tear takes the sealed crimp and a little shoulder, clear of the logo.
export const FOIL = { bottom: -.74, seam: .615, top: .74 };
export const PRO_TEAR_FROM_TOP = (FOIL.top - FOIL.seam) / (FOIL.top - FOIL.bottom);

export function foilGeometry(strip = false) {
  const geometry = new THREE.PlaneGeometry(1, 1, 144, strip ? 16 : 100);
  const uv = geometry.attributes.uv;
  geometry.setAttribute('shapeUv', uv.clone());
  for (let i = 0; i < uv.count; i++) {
    const y = strip ? FOIL.seam + uv.getY(i) * (FOIL.top - FOIL.seam)
      : FOIL.bottom + uv.getY(i) * (FOIL.seam - FOIL.bottom);
    uv.setY(i, (y - FOIL.bottom) / (FOIL.top - FOIL.bottom));
  }
  return geometry;
}

function foilDepth(u: number, y: number) {
  const across = Math.max(0, Math.sin(Math.PI * u));
  const end = smooth((y - FOIL.bottom) / .15), top = smooth((FOIL.top - y) / .16);
  const pillow = .045 * Math.pow(across, .65) * end * top;
  // Broad, irregular shoulder folds. Tiny corrugations belong only to the crimp.
  const shoulders = Math.exp(-Math.pow((y - .59) / .055, 2))
    + .7 * Math.exp(-Math.pow((y + .65) / .05, 2));
  const wrinkle = (.0015 * Math.sin(u * 43 + y * 7 + Math.sin(u * 17))
    + .00055 * Math.sin(u * 79 - y * 13)) * shoulders * across;
  const sideCrease = .0012 * Math.sin(y * 22 + u * 9) * Math.pow(1 - across, 3);
  const seal = (y < -.685 || y > .685) ? .0009 * Math.cos(u * Math.PI * 144) : 0;
  return .0025 + pillow + wrinkle + sideCrease * end * top + seal;
}

function tornEdge(u: number) {
  return .0018 * Math.sin(u * 311) + .001 * Math.sin(u * 701) + .0018 * Math.sin(u * 31);
}

export function deformFoil(geometry: THREE.PlaneGeometry, side: number, tear: number, mouth: number, strip = false, loose = 0) {
  const positions = geometry.attributes.position, uv = geometry.attributes.shapeUv;
  for (let i = 0; i < positions.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    const released = smooth((tear - u) / .10);
    let x = u - .5;
    let y = strip ? FOIL.seam + v * (FOIL.top - FOIL.seam)
      : FOIL.bottom + v * (FOIL.seam - FOIL.bottom);
    let z = foilDepth(u, y) * side;
    if (strip) {
      const length = Math.max(0, tear - u);
      // A travelling bend stays just behind the tear. The free end droops and
      // twists after release; the strip never behaves as a rigid cut-off bar.
      const bend = Math.sin(Math.min(1, length / .44) * Math.PI);
      const sag = Math.sin(u * Math.PI) * loose;
      x += released * (.016 * bend + length * .02);
      y += released * (.016 + .095 * length + .028 * bend - .13 * sag + tornEdge(u) * (1 - v));
      z += released * (.05 + .13 * bend + .035 * v + .09 * sag);
      y += loose * .035 * Math.sin(u * Math.PI * 2) * (v - .5);
      if (v > .999) y += .0015 * Math.cos(u * Math.PI * 144);
    } else {
      const lip = Math.pow(v, 15), across = Math.sin(Math.PI * u);
      const opening = across * (1 + .18 * Math.sin(u * Math.PI * 2));
      z += side * mouth * .095 * opening * lip;
      y -= mouth * (side === 1 ? .048 : -.012) * opening * lip;
      y += tornEdge(u) * released * lip;
      if (v < .001) y += .0015 * Math.cos(u * Math.PI * 144);
    }
    positions.setXYZ(i, x, y * PRO_PACK_VERTICAL_SCALE, z);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}
