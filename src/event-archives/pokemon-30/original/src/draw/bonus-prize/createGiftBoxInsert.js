import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export function createGiftBoxInsert(material) {
    const group = new THREE.Group();
    group.name = 'clear-moulded-insert';
    // Thermoformed floor: shallow foot wells, raised shoulders and a folded perimeter.
    const surface = new THREE.PlaneGeometry(2.78, 1.94, 56, 40);
    surface.rotateX(-Math.PI / 2);
    const positions = surface.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), z = positions.getZ(i);
        let height = -0.592;
        for (const foot of [-0.38, 0.38]) {
            const radius = Math.sqrt(((x - foot) / 0.27) ** 2 + ((z - 0.4) / 0.38) ** 2);
            height += 0.045 * Math.exp(-(((radius - 1.1) / 0.17) ** 2));
        }
        height += 0.065 * Math.exp(-(((Math.abs(x) - 1.33) / 0.045) ** 2));
        height += 0.03 * Math.exp(-(((Math.abs(z) - 0.90) / 0.05) ** 2));
        positions.setY(i, height);
    }
    surface.computeVertexNormals();
    const tray = new THREE.Mesh(surface, material);
    tray.name = 'clear-tray';
    group.add(tray);
    const outline = new THREE.CatmullRomCurve3([
        [-1.36, -0.579, 0.91], [-1.39, -0.579, 0.82], [-1.39, -0.579, -0.82],
        [-1.30, -0.579, -0.95], [1.30, -0.579, -0.95], [1.39, -0.579, -0.82],
        [1.39, -0.579, 0.82], [1.30, -0.579, 0.95], [-1.30, -0.579, 0.95],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)), true, 'centripetal');
    const rim = new THREE.Mesh(new THREE.TubeGeometry(outline, 96, 0.012, 8, true), material);
    rim.name = 'pressed-tray-rim';
    group.add(rim);
    for (const x of [-1.28, 1.28]) {
        const flange = new THREE.Mesh(new RoundedBoxGeometry(0.10, 1.72, 0.12, 3, 0.035), material);
        flange.position.set(x, 0.26, -0.87);
        flange.name = 'moulded-rear-retaining-flange';
        group.add(flange);
    }
    return group;
}
