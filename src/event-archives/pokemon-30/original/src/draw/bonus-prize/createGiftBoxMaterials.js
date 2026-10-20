import * as THREE from 'three';
/** Fine coating texture, authored independently of the printed color image. */
function coatingGrain() {
    const size = 1024;
    const pixels = new Uint8Array(size * size);
    let seed = 3041;
    for (let i = 0; i < pixels.length; i++) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        pixels[i] = 120 + (seed >>> 0) % 17;
    }
    const texture = new THREE.DataTexture(pixels, size, size, THREE.RedFormat);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
}
export function createGiftBoxMaterials(print) {
    const grain = coatingGrain();
    const paper = new THREE.MeshPhysicalMaterial({
        color: '#680d17', roughness: 0.36, metalness: 0,
        clearcoat: 0.62, clearcoatRoughness: 0.22,
        specularIntensity: 0.75, envMapIntensity: 0.68,
        bumpMap: grain, bumpScale: 0.001,
    });
    const printedPaper = new THREE.MeshPhysicalMaterial({
        map: print, roughness: 0.36, metalness: 0,
        clearcoat: 0.62, clearcoatRoughness: 0.22,
        specularIntensity: 0.75, envMapIntensity: 0.68,
        bumpMap: grain, bumpScale: 0.001,
    });
    // Foil is a local material response; the reference's RGB is never used as height.
    printedPaper.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      float centralPrint = step(0.215, vMapUv.x) * step(vMapUv.x, 0.785);
      float goldInk = centralPrint
        * smoothstep(0.055, 0.22, diffuseColor.r - diffuseColor.b)
        * smoothstep(0.018, 0.16, diffuseColor.g - diffuseColor.b);
    `).replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.24, goldInk);
    `).replace('#include <metalnessmap_fragment>', `
      #include <metalnessmap_fragment>
      metalnessFactor = mix(metalnessFactor, 0.32, goldInk);
    `);
    };
    printedPaper.customProgramCacheKey = () => 'gift-box-foil-v4';
    const pet = new THREE.MeshPhysicalMaterial({
        color: '#ffffff', transmission: 1, opacity: 1,
        roughness: 0.003, metalness: 0, ior: 1.47, thickness: 0.008,
        clearcoat: 0, clearcoatRoughness: 0.06,
        envMapIntensity: 0.9, transparent: true, depthWrite: false,
        side: THREE.DoubleSide,
    });
    const insert = new THREE.MeshPhysicalMaterial({
        color: '#ffffff', roughness: 0.045, metalness: 0,
        transmission: 0.98, thickness: 0.025, ior: 1.46,
        envMapIntensity: 0.65, transparent: true, opacity: 1,
        depthWrite: false, side: THREE.DoubleSide,
    });
    const lining = new THREE.MeshStandardMaterial({ color: '#28211f', roughness: 0.68, envMapIntensity: 0.3 });
    const trayBase = new THREE.MeshPhysicalMaterial({ color: '#241a18', roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.12, envMapIntensity: 0.4 });
    const cutEdge = new THREE.MeshStandardMaterial({ color: '#561e22', roughness: 0.65 });
    return { paper, printedPaper, pet, insert, lining, trayBase, cutEdge };
}
