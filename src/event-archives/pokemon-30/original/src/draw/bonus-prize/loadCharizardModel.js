import { archiveAssetUrl } from "../../../../../shared/archiveAssets.js";
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
const decoderScript = archiveAssetUrl("pokemon-30/runtime/draco_wasm_wrapper.js");
const decoderWasm = archiveAssetUrl("pokemon-30/runtime/draco_decoder.wasm");
import { createFigurineFinish } from './createFigurineFinish';
const modelUrl = archiveAssetUrl("pokemon-30/src/draw/bonus-prize/assets/charizard-product-v6.glb"); /** Product-photo reconstruction; source and inferred regions are documented in assets/README.md. */
export async function loadCharizardModel() {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => url.endsWith('draco_wasm_wrapper.js') ? decoderScript : url.endsWith('draco_decoder.wasm') ? decoderWasm : url);
    const decoder = new DRACOLoader(manager).setDecoderPath('/event-draco/').setWorkerLimit(1);
    try {
        const gltf = await new GLTFLoader(manager).setDRACOLoader(decoder).loadAsync(modelUrl);
        const figure = gltf.scene;
        figure.name = 'reconstructed-product-figurine';
        // The retail figurine presents its open jaw toward the viewer's left.
        figure.rotation.y = -0.4;
        const finishes = new Map();
        figure.traverse((object) => {
            if (!(object instanceof THREE.Mesh))
                return;
            object.castShadow = true;
            object.receiveShadow = true;
            const original = object.material;
            if (!finishes.has(original))
                finishes.set(original, createFigurineFinish(original));
            object.material = finishes.get(original);
        });
        finishes.forEach((_, original) => original.dispose());
        figure.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(figure, true);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        if (size.x <= 0 || size.y <= 0 || size.z <= 0)
            throw new Error('Product figurine has invalid bounds');
        const scale = Math.min(2.55 / size.x, 1.72 / size.y, 2.0 / size.z);
        const pivot = new THREE.Group();
        pivot.name = 'figurine-pivot';
        pivot.add(figure);
        figure.position.sub(center);
        pivot.scale.setScalar(scale);
        pivot.userData.sourceBounds = size.toArray();
        pivot.userData.isRealMesh = true;
        pivot.userData.provenance = 'product-photo-reconstruction-v6';
        return pivot;
    }
    finally {
        decoder.dispose();
    }
}
