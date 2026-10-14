import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Merge only rigid parts within one named pivot. Lid, cavity, hardware and each
// stock-token pivot remain separate and can still be animated independently.
export function mergeRigidParts(root: THREE.Group, owned: THREE.BufferGeometry[]) {
  const pivots: THREE.Object3D[] = []; root.traverse(node => { if (node instanceof THREE.Group) pivots.push(node); });
  for (const pivot of pivots) {
    const batches = new Map<string, THREE.Mesh<THREE.BufferGeometry,THREE.Material>[]>();
    for (const node of pivot.children) {
      if (!(node instanceof THREE.Mesh) || node instanceof THREE.InstancedMesh || Array.isArray(node.material)) continue;
      const key = `${node.material.uuid}:${node.castShadow}:${node.receiveShadow}`;
      const batch = batches.get(key) ?? []; batch.push(node); batches.set(key,batch);
    }
    for (const batch of batches.values()) {
      if (batch.length < 2) continue;
      const prepared = batch.map(mesh => {
        mesh.updateMatrix(); const copy = mesh.geometry.clone().applyMatrix4(mesh.matrix);
        if (!copy.index) return copy;
        const expanded = copy.toNonIndexed(); copy.dispose(); return expanded;
      });
      const geometry = mergeGeometries(prepared,false); prepared.forEach(g => g.dispose());
      if (!geometry) throw new Error(`Film box rigid mesh merge failed at ${pivot.name}`);
      owned.push(geometry);
      const mesh = new THREE.Mesh(geometry,batch[0].material); mesh.name = `${pivot.name}.rigidSurface`;
      mesh.castShadow = batch[0].castShadow; mesh.receiveShadow = batch[0].receiveShadow;
      batch.forEach(part => part.removeFromParent()); pivot.add(mesh);
    }
  }
}
