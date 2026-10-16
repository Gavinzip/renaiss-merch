import * as THREE from 'three';

/** Each renderer owns disposable GPU objects; decoded image/vertex data is reused. */
export function cloneCharizardModel(source: THREE.Group) {
  const instance = source.clone(true);
  const geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const materials = new Map<THREE.Material, THREE.Material>();
  const textures = new Map<THREE.Texture, THREE.Texture>();
  const copyMaterial = (sourceMaterial: THREE.Material) => {
    let material = materials.get(sourceMaterial);
    if (!material) {
      material = sourceMaterial.clone();
      for (const [key, value] of Object.entries(material)) {
        if (!(value instanceof THREE.Texture)) continue;
        if (!textures.has(value)) textures.set(value, value.clone());
        Object.assign(material, { [key]: textures.get(value)! });
      }
      materials.set(sourceMaterial, material);
    }
    return material;
  };
  instance.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!geometries.has(object.geometry)) geometries.set(object.geometry, object.geometry.clone());
    object.geometry = geometries.get(object.geometry)!;
    object.material = Array.isArray(object.material)
      ? object.material.map(copyMaterial) : copyMaterial(object.material);
  });
  return instance;
}
