import * as THREE from 'three';

// Full-bleed print faces meet a thin card-stock edge. Keep all three surfaces
// on the same outline; an oversized bevel reads as a case around the card.
function outline(w: number, h: number, r: number) {
  const shape = new THREE.Shape(), x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  shape.lineTo(x + w, y + h - r); shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  shape.lineTo(x + r, y + h); shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  shape.lineTo(x, y + r); shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5); return shape;
}
function faceGeometry(w: number, h: number, r: number) {
  const geometry = new THREE.ShapeGeometry(outline(w, h, r), 12), position = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) uv.setXY(i, (position.getX(i) + w / 2) / w, (position.getY(i) + h / 2) / h);
  return geometry;
}
export function createSurfCeremonyCard(frontTexture: THREE.Texture, backTexture: THREE.Texture) {
  const group = new THREE.Group();
  const edge = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#e2e1e0', metalness: .08, roughness: .64 }));
  const front = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: frontTexture, toneMapped: false }));
  const back = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: backTexture, toneMapped: false }));
  front.position.z = .42; back.position.z = -.42; back.rotation.y = Math.PI;
  group.add(edge, front, back); group.visible = false;
  let width = 0, height = 0, radius = 0;
  function resize(w: number, h: number, r = Math.min(13, w * .06)) {
    if (w === width && h === height && r === radius) return; width = w; height = h; radius = r;
    group.children.forEach(child => (child as THREE.Mesh).geometry.dispose());
    edge.geometry = new THREE.ExtrudeGeometry(outline(w, h, r), { depth: .8, steps: 1, curveSegments: 12, bevelEnabled: false }); edge.geometry.translate(0, 0, -.4);
    front.geometry = faceGeometry(w, h, r); back.geometry = faceGeometry(w, h, r);
  }
  return { group, front, back, resize, dispose() { group.children.forEach(child => { const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>; mesh.geometry.dispose(); mesh.material.dispose(); }); } };
}
