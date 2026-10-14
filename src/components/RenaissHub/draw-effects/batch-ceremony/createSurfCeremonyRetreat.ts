import * as THREE from 'three';

// Fade one image of the assembled opaque box. Mesh-by-mesh transparency makes
// the rear shell and cavity show through the front; scaling to zero makes the
// box look like a toy. The capture stays behind the flying cards in 3D depth.
export function createSurfCeremonyRetreat(
  scene: THREE.Scene,
  camera: THREE.OrthographicCamera,
  renderer: THREE.WebGLRenderer,
  boxRoot: THREE.Object3D,
  lights: THREE.Light[],
) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    samples: 4,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: target.texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const geometry = new THREE.PlaneGeometry(1, 1);
  const image = new THREE.Mesh(geometry, material);
  image.name = 'surfBoxRetreatImage';
  image.position.z = -300;
  image.visible = false;
  scene.add(image);

  boxRoot.traverse(node => node.layers.enable(1));
  lights.forEach(light => light.layers.enable(1));

  return {
    resize(width: number, height: number, ratio: number) {
      target.setSize(Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio)));
      image.scale.set(width, height, 1);
    },
    draw(opacity: number) {
      if (opacity > 0 && opacity < 1 && boxRoot.visible) {
        try {
          camera.layers.set(1);
          renderer.setRenderTarget(target);
          renderer.render(scene, camera);
        } finally {
          renderer.setRenderTarget(null);
          camera.layers.set(0);
        }
        boxRoot.visible = false;
        image.visible = true;
        material.opacity = opacity;
        try { renderer.render(scene, camera); }
        finally { image.visible = false; boxRoot.visible = true; }
      } else {
        renderer.render(scene, camera);
      }
    },
    dispose() { image.removeFromParent(); geometry.dispose(); material.dispose(); target.dispose(); },
  };
}
