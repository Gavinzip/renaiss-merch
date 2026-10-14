import * as THREE from 'three';

// 30th ann's solid rounded card construction: two opaque print faces and a
// separate bevelled metal edge. No CSS transform planes or alpha sorting.
function outline(w: number, h: number, r: number) {
  const shape = new THREE.Shape(), x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y); return shape;
}
function faceGeometry(w: number, h: number, r: number) {
  const geometry = new THREE.ShapeGeometry(outline(w, h, r), 12), position = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) uv.setXY(i, (position.getX(i) + w / 2) / w, (position.getY(i) + h / 2) / h);
  return geometry;
}
export function createSurfCeremonyCard(frontTexture: THREE.Texture, backTexture: THREE.Texture) {
  const group = new THREE.Group();
  const edge = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#c6c9d2', metalness: .88, roughness: .22 }));
  const front = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: frontTexture, toneMapped: false }));
  const back = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: backTexture, toneMapped: false }));
  front.position.z = 1.85; back.position.z = -1.85; back.rotation.y = Math.PI;
  group.add(edge, front, back); group.visible = false;
  let width = 0, height = 0;
  function resize(w: number, h: number) {
    if (w === width && h === height) return; width = w; height = h;
    group.children.forEach(child => (child as THREE.Mesh).geometry.dispose());
    edge.geometry = new THREE.ExtrudeGeometry(outline(w, h, Math.min(13, w * .06)), { depth: 2.6, steps: 1, curveSegments: 10, bevelEnabled: true, bevelSegments: 2, bevelThickness: .35, bevelSize: .5 }); edge.geometry.translate(0, 0, -1.3);
    front.geometry = faceGeometry(w - 2, h - 2, Math.min(12, w * .06)); back.geometry = faceGeometry(w - 2, h - 2, Math.min(12, w * .06));
  }
  return { group, front, back, resize, dispose() { group.children.forEach(child => { const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>; mesh.geometry.dispose(); mesh.material.dispose(); }); } };
}
