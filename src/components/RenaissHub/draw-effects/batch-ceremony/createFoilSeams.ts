import * as THREE from 'three';

// Join the existing front/back boundary vertices. The body has no top cap,
// leaving a real mouth when the strip detaches. No new silhouette is invented.
export function createFoilSeams(front: THREE.PlaneGeometry, back: THREE.PlaneGeometry, strip: boolean) {
  const columns = front.parameters.widthSegments + 1, rows = front.parameters.heightSegments + 1;
  const edges = [
    Array.from({ length: rows }, (_, row) => row * columns),
    Array.from({ length: rows }, (_, row) => row * columns + columns - 1),
    Array.from({ length: columns }, (_, column) => (rows - 1) * columns + column),
    ...(strip ? [Array.from({ length: columns }, (_, column) => column)] : []),
  ];
  const count = edges.reduce((sum, edge) => sum + (edge.length - 1) * 6, 0);
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3);
  geometry.setAttribute('position', positions);
  function update() {
    const a = front.attributes.position, b = back.attributes.position;
    let vertex = 0;
    const copy = (source: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, index: number) => {
      positions.setXYZ(vertex++, source.getX(index), source.getY(index), source.getZ(index));
    };
    for (const edge of edges) for (let i = 0; i < edge.length - 1; i++) {
      const from = edge[i], to = edge[i + 1];
      copy(a, from); copy(b, from); copy(a, to);
      copy(a, to); copy(b, from); copy(b, to);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  }
  return { geometry, update };
}
