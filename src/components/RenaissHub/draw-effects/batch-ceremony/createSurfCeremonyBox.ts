import * as THREE from 'three';
import { createSurfFilmBoxModel } from '../film-box/createSurfFilmBoxModel';
import { FILM_BOX as D } from '../film-box/filmBoxDesign';
import { createSurfCeremonyCavityLight } from './createSurfCeremonyCavityLight';
import { smooth, CEREMONY, boxOpening, boxRetreatAt, type CeremonyLayout } from './ceremonyTimeline';

// The box is rigid: the lid cracks, releases and seats against the hinge while
// the weight of the base gives a small counter-reaction. One floor anchor and a
// fixed open-pose emitter keep the card handoff continuous through its exit.
export function createSurfCeremonyBox(scene: THREE.Scene, atlas: ImageBitmap) {
  const model = createSurfFilmBoxModel(atlas);
  const cavityLight = createSurfCeremonyCavityLight(model.root);
  scene.add(model.root);
  const pitch = .4, yaw = -.1;
  const orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0));
  const liveOrientation = new THREE.Quaternion();
  const point = new THREE.Vector3(), position = new THREE.Vector3();
  const scale = new THREE.Vector3(), matrix = new THREE.Matrix4();
  const hingeAxis = new THREE.Vector3(1, 0, 0);

  // Reserve space for the entire lid sweep before the motion starts. A changing
  // per-frame clamp would make the base slide each time the lid rises higher.
  let sweptTop = 0;
  for (let step = 0; step <= 20; step++) {
    for (const x of [-D.width / 2, D.width / 2]) {
      for (const y of [0, D.lidHeight]) for (const z of [0, D.depth]) {
        point.set(x, y, z)
          .applyAxisAngle(hingeAxis, -D.openingAngle * D.maxOpening * step / 20)
          .add(model.lid.position).applyQuaternion(orientation);
        sweptTop = Math.max(sweptTop, point.y);
      }
    }
  }
  const foot = D.depth / 2 * Math.sin(pitch);

  return {
    render(phase: string, age: number, layout: CeremonyLayout, reduced: boolean) {
      const opening = phase === 'settling';
      const motion = opening ? boxOpening(age) : { lid: 0, kick: 0, pullback: 0, charge: 0 };
      const retreat = opening ? smooth((age - boxRetreatAt(layout.cards.length)) / CEREMONY.boxRetreat) : 0;
      const floorY = Math.min(layout.height - 28, layout.center.y + layout.unit * .75);
      const closedSize = layout.unit;
      const openSize = Math.min(closedSize * .9, (floorY - layout.safeTop - 18) / (sweptTop + foot));
      const size = closedSize + (openSize - closedSize) * motion.pullback;
      // Keep the prop's mass as it moves behind the cards. The whole rendered
      // box is composited during the fade, so its opaque inner shell stays solid.
      const displaySize = size * (1 + motion.charge * .065) * (1 - retreat * .14);

      model.root.visible = phase === 'idle' || phase === 'spinning' || opening && retreat < 1;
      model.root.scale.setScalar(displaySize);
      model.root.position.set(
        layout.center.x - layout.width / 2,
        layout.height / 2 - floorY + displaySize * foot - motion.charge * layout.unit * .025
          + motion.kick * layout.unit * .09 + retreat * layout.unit * .1,
        -retreat * 140,
      );
      liveOrientation.setFromEuler(new THREE.Euler(pitch - motion.charge * .055 + motion.kick * .08,
        yaw + motion.charge * .025, motion.kick * -.016));
      model.root.quaternion.copy(liveOrientation);
      const close = smooth((retreat - .08) / .72);
      model.setOpening(reduced && opening ? 1 : motion.lid * (1 - close));
      const release = age >= CEREMONY.burst ? Math.exp(-(age - CEREMONY.burst) * 5) : 0;
      model.setCharge(opening ? Math.min(1, motion.charge * .52 + motion.lid * .7 + release * .3) * (1 - retreat) : 0);
      cavityLight.render(phase, age, layout.cards.length, reduced);
      // The meshes stay opaque. The caller fades a flattened capture of the
      // assembled box, avoiding visible inner/back faces during its exit.

      // Compute even after the box disappears: no moving source during flight,
      // and no source reset at box removal. Derive it only from layout geometry.
      position.set(layout.center.x - layout.width / 2, layout.height / 2 - floorY + openSize * foot, 0);
      scale.setScalar(openSize);
      matrix.compose(position, orientation, scale);
      point.copy(model.root.userData.sculptRuntime.sockets.cardEmit).applyMatrix4(matrix);
      layout.emitter = { x: point.x + layout.width / 2, y: layout.height / 2 - point.y, z: point.z };
      model.root.updateMatrixWorld(true);
      point.set(0, D.baseHeight + D.seam * .5, D.depth / 2).applyMatrix4(model.root.matrixWorld);
      return { visible: model.root.visible, opacity: 1 - smooth((retreat - .2) / .8), size: displaySize, floorY,
        light: { x: point.x + layout.width / 2, y: layout.height / 2 - point.y, width: displaySize * D.width } };
    },
    root: model.root,
    dispose() { cavityLight.dispose(); model.dispose(); },
  };
}
