import * as THREE from 'three';
function roundedRect(width, height, radius, centerY = 0) {
    const x = -width / 2, y = -height / 2 + centerY;
    const path = new THREE.Shape();
    path.moveTo(x + radius, y);
    path.lineTo(x + width - radius, y);
    path.quadraticCurveTo(x + width, y, x + width, y + radius);
    path.lineTo(x + width, y + height - radius);
    path.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    path.lineTo(x + radius, y + height);
    path.quadraticCurveTo(x, y + height, x, y + height - radius);
    path.lineTo(x, y + radius);
    path.quadraticCurveTo(x, y, x + radius, y);
    return path;
}
/** The retail rear has its own window displaying the jumbo card, facing outward. */
export function createGiftBoxRear(paper, pet, print) {
    const group = new THREE.Group();
    group.name = 'rear-card-display';
    group.position.z = -1.12;
    group.rotation.y = Math.PI;
    const opening = roundedRect(1.78, 2.43, 0.075, -0.075);
    const frameShape = roundedRect(3, 3, 0.004);
    frameShape.holes.push(opening);
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, {
        depth: 0.027, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2,
    }), paper);
    frame.name = 'rear-die-cut-carton';
    frame.castShadow = frame.receiveShadow = true;
    group.add(frame);
    const cardHeight = 2.38;
    const cardWidth = cardHeight * 13.3 / 18.7;
    const cardGeometry = new THREE.ShapeGeometry(roundedRect(cardWidth, cardHeight, 0.06), 12);
    const position = cardGeometry.getAttribute('position');
    const uv = cardGeometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++)
        uv.setXY(i, position.getX(i) / cardWidth + 0.5, position.getY(i) / cardHeight + 0.5);
    const card = new THREE.Mesh(cardGeometry, new THREE.MeshPhysicalMaterial({
        map: print, roughness: 0.29, metalness: 0.16, clearcoat: 0.7, clearcoatRoughness: 0.16, envMapIntensity: 0.6,
    }));
    card.name = 'jumbo-charizard-card';
    card.position.set(0, -0.075, -0.035);
    group.add(card);
    const holder = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(1.78, 2.43, 0.075), 12), pet);
    holder.name = 'rear-card-pet-cover';
    holder.position.set(0, -0.075, 0.012);
    group.add(holder);
    return group;
}
