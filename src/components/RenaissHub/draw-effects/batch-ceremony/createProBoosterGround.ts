import * as THREE from 'three';

/** Faint mirrored foil and a separate soft contact shadow for each pouch. */
export function createProBoosterGround(parent: THREE.Group, packs: THREE.Group[]) {
  const root = new THREE.Group(); parent.add(root);
  const art = document.createElement('canvas'); art.width = 256; art.height = 64;
  const pen = art.getContext('2d')!;
  pen.scale(1, .25);
  const gradient = pen.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(48,45,54,.32)');
  gradient.addColorStop(.35, 'rgba(48,45,54,.17)');
  gradient.addColorStop(1, 'rgba(48,45,54,0)');
  pen.fillStyle = gradient; pen.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(art), plane = new THREE.PlaneGeometry(1, 1);
  const mirror = new THREE.Matrix4().makeScale(1, -1, 1);
  const items = packs.map(pack => {
    const reflection = pack.clone(true); reflection.matrixAutoUpdate = false;
    const uniforms = { floor: { value: 0 }, reach: { value: 1 } };
    const materials: THREE.Material[] = [];
    reflection.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.name === 'foilInterior') { object.visible = false; return; }
      const material = object.material.clone() as THREE.MeshStandardMaterial;
      material.transparent = true; material.opacity = .18; material.depthWrite = false;
      const compile = object.material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        compile.call(material, shader, renderer);
        shader.uniforms.uFoilFloor = uniforms.floor;
        shader.uniforms.uFoilReach = uniforms.reach;
        shader.vertexShader = 'varying float vFoilGroundY;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
          '#include <project_vertex>\nvFoilGroundY = (modelMatrix * vec4(transformed, 1.0)).y;');
        shader.fragmentShader = 'varying float vFoilGroundY;\nuniform float uFoilFloor;\nuniform float uFoilReach;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          float floorDistance = (uFoilFloor - vFoilGroundY) / uFoilReach;
          if (floorDistance < 0.0) discard;
          diffuseColor.a *= pow(1.0 - smoothstep(0.0, 1.0, floorDistance), 2.0);
          #include <opaque_fragment>`);
      };
      material.customProgramCacheKey = () => 'foil-ground-v1';
      object.material = material; materials.push(material);
    });
    const shadowMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
    const shadow = new THREE.Mesh(plane, shadowMaterial); shadow.position.z = -550;
    root.add(reflection, shadow);
    return { pack, reflection, strip: reflection.getObjectByName('foilStrip')!, uniforms, materials, shadow, shadowMaterial };
  });
  return {
    render(index: number, floorY: number, height: number, opacity: number) {
      const item = items[index], { pack, reflection } = item;
      reflection.visible = item.shadow.visible = pack.visible && opacity > 0;
      if (!reflection.visible) return;
      pack.updateMatrix(); reflection.matrix.copy(mirror).multiply(pack.matrix);
      reflection.matrix.elements[13] += 2 * floorY;
      reflection.matrixWorldNeedsUpdate = true;
      const strip = pack.getObjectByName('foilStrip')!;
      item.strip.position.copy(strip.position); item.strip.quaternion.copy(strip.quaternion); item.strip.visible = strip.visible;
      item.uniforms.floor.value = floorY; item.uniforms.reach.value = height * .52;
      item.materials.forEach(material => { material.opacity = .18 * opacity; });
      item.shadow.position.set(pack.position.x, floorY, -550);
      const facing = .35 + .65 * Math.abs(Math.cos(pack.rotation.y));
      item.shadow.scale.set(pack.scale.x * 1.5 * facing, Math.max(16, height * .045), 1);
      item.shadowMaterial.opacity = opacity;
    },
    dispose() {
      root.removeFromParent();
      items.forEach(item => { item.materials.forEach(material => material.dispose()); item.shadowMaterial.dispose(); });
      plane.dispose(); texture.dispose();
    },
  };
}
