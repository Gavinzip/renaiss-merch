import * as THREE from 'three';

// Broad photographic reflectors with dark gaps give chrome a readable edge.
export function createFilmBoxEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#858589');
  const geometry = new THREE.PlaneGeometry(1,1), materials: THREE.MeshBasicMaterial[] = [];
  for (const [position, scale, color] of [
    [[-1.8,-1,5],[4,4,1],[1.4,1.35,1.35]],
    [[-1.5,3.5,5],[5,2.4,1],[3.2,3.0,2.9]],
    [[-4,.2,0],[2,7,1],[.8,.85,.95]],
    [[4,.2,0],[2,7,1],[.8,.9,1.05]],
    [[0,5,-2],[3,1.5,1],[2.2,2.0,2.1]]
  ] as const) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...color), side: THREE.DoubleSide }); materials.push(mat);
    const plane = new THREE.Mesh(geometry,mat); plane.position.set(position[0],position[1],position[2]); plane.scale.set(scale[0],scale[1],scale[2]); plane.lookAt(0,.5,0); scene.add(plane);
  }
  const pmrem = new THREE.PMREMGenerator(renderer), target = pmrem.fromScene(scene,.025);
  geometry.dispose(); materials.forEach(m=>m.dispose()); pmrem.dispose(); return target;
}
