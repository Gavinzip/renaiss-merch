import * as THREE from 'three';
export function disposeScene(root) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    root.traverse((object) => {
        if (object instanceof THREE.Light && 'shadow' in object)
            object.shadow?.dispose();
        if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Points))
            return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            materials.add(material);
            for (const value of Object.values(material))
                if (value instanceof THREE.Texture)
                    textures.add(value);
        }
    });
    geometries.forEach((value) => value.dispose());
    materials.forEach((value) => value.dispose());
    textures.forEach((value) => value.dispose());
}
