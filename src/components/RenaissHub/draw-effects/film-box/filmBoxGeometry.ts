import * as THREE from 'three';

export function octagon(width: number, depth: number, cut: number) {
  const x = width / 2, z = depth / 2;
  return [[-x + cut, -z], [x - cut, -z], [x, -z + cut], [x, z - cut], [x - cut, z], [-x + cut, z], [-x, z - cut], [-x, -z + cut]] as [number, number][];
}
export function prism(width: number, depth: number, height: number, cut: number, bevel = .008) {
  const shape = new THREE.Shape(octagon(width, depth, cut).map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height - bevel * 2, bevelEnabled: bevel > 0, bevelSegments: 2, steps: 1, bevelSize: bevel, bevelThickness: bevel, curveSegments: 1 });
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, bevel, 0);
  return geometry;
}

export function shellRing(width: number, depth: number, height: number, cut: number, wall: number, bevel = .004) {
  const shape = new THREE.Shape(octagon(width, depth, cut).map(([x, y]) => new THREE.Vector2(x, y)));
  const inner = octagon(width - wall * 2, depth - wall * 2, Math.max(.015, cut - wall * .45));
  shape.holes.push(new THREE.Path(inner.reverse().map(([x, y]) => new THREE.Vector2(x, y))));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height - bevel * 2, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: bevel, bevelThickness: bevel, curveSegments: 1 });
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, bevel, 0); return geometry;
}

export function cornerBand(width: number, depth: number, cut: number, span: number, height: number) {
  const x = width / 2, z = depth / 2, t = .028;
  const points = [[x, z - span], [x, z - cut], [x - cut, z], [x - span, z], [x - span, z - t], [x - cut - t * .4, z - t], [x - t, z - cut - t * .4], [x - t, z - span]];
  const shape = new THREE.Shape(points.map(([a, b]) => new THREE.Vector2(a, b)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: height - .008, bevelEnabled: true, bevelSegments: 1, bevelSize: .004, bevelThickness: .004, steps: 1, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, .004, 0); return g;
}
export function frontPanel(width: number, height: number, thickness: number) {
  const g = prism(width, height, thickness, .025, .003); g.rotateX(Math.PI / 2); return g;
}
export function tokenRim() {
  // Stepped outer lip, recessed face bed, grooved cylindrical side, underside lip.
  const profile = [[.131, -.025], [.146, -.025], [.154, -.018], [.154, -.009], [.150, -.006], [.150, .006], [.154, .010], [.154, .018], [.146, .026], [.132, .026], [.132, .015], [.131, -.025]];
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 64);
}

export function mirrorGeometry(geometry: THREE.BufferGeometry, sx: number, sz: number) {
  geometry.scale(sx,1,sz);
  if (sx * sz > 0) return geometry;
  const index = geometry.index;
  if (index) {
    for (let i=0;i<index.count;i+=3) { const b=index.getX(i+1); index.setX(i+1,index.getX(i+2)); index.setX(i+2,b); }
  } else {
    for (const attribute of Object.values(geometry.attributes)) {
      for (let i=0;i<attribute.count;i+=3) for (let c=0;c<attribute.itemSize;c++) {
        const b=attribute.getComponent(i+1,c); attribute.setComponent(i+1,c,attribute.getComponent(i+2,c)); attribute.setComponent(i+2,c,b);
      }
    }
  }
  return geometry;
}
