import * as THREE from 'three';
/** Preserve the reconstructed product's paint and surface maps under scene lighting. */
export function createFigurineFinish(source) {
    const material = new THREE.MeshPhysicalMaterial({
        name: 'painted-vinyl-figurine',
        color: source.color.clone(),
        map: source.map,
        normalMap: source.normalMap,
        normalScale: source.normalScale.clone().multiplyScalar(0.65),
        roughnessMap: source.roughnessMap,
        roughness: source.roughnessMap ? 0.72 : 0.34,
        metalness: 0,
        aoMap: source.aoMap,
        aoMapIntensity: 0.65,
        side: source.side,
        clearcoat: 0.28,
        clearcoatRoughness: 0.24,
        envMapIntensity: 0.65,
    });
    for (const texture of [material.map, material.normalMap, material.roughnessMap, material.aoMap]) {
        if (texture)
            texture.anisotropy = 8;
    }
    return material;
}
