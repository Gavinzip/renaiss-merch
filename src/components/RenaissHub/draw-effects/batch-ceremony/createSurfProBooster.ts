import { PRO_PACK_ASPECT, PRO_PACK_VERTICAL_SCALE } from './proBoosterDimensions';
import * as THREE from 'three';
import type { CeremonyArtwork } from './ceremonyArtwork';
import { proBoosterLayout, proBoosterMotion, proAgeForTear } from './proBoosterTimeline';
import { createProBoosterMaterials } from './proBoosterMaterials';
import { createProFoilPack } from './createProFoilPack';
import { createProBoosterCarousel, PRO_PACK_COUNT } from './proBoosterCarousel';
import type { CeremonyLayout } from './ceremonyTimeline';
import type { RevealPhase } from '../../useSurfDrawPresentation';

export function createSurfProBooster(scene: THREE.Scene, renderer: THREE.WebGLRenderer, art: CeremonyArtwork) {
  const root = new THREE.Group(); scene.add(root);
  const materials = createProBoosterMaterials(renderer, art), carousel = createProBoosterCarousel();
  const packs = Array.from({ length: PRO_PACK_COUNT }, () => {
    const pack = createProFoilPack(materials); pack.deform(0, 0); root.add(pack.root); return pack;
  });
  return {
    root, carousel,
    render(phase: RevealPhase, age: number, layout: CeremonyLayout, opened: boolean, preview: number, reduced: boolean) {
      const stage = proBoosterLayout(layout), active = phase === 'settling' && opened;
      const motion = proBoosterMotion(active ? age : proAgeForTear(preview * .65));
      root.visible = (phase === 'idle' || phase === 'spinning' || phase === 'settling') && !reduced;
      let selectedWidth = stage.width * .8;
      packs.forEach((pack, index) => {
        const pose = carousel.pose(index), distance = pose.distance;
        const angle = distance * Math.PI * 2 / PRO_PACK_COUNT, orbitX = Math.sin(angle) / Math.sin(Math.PI * 2 / PRO_PACK_COUNT);
        const focus = pose.focus, width = stage.width * (.80 + .20 * focus);
        const scale = width / (1 + .21 * Math.abs(distance)) * (pose.chosen ? 1 : 1 - .2 * focus);
        const x = orbitX * (stage.width * 1.04 + (pose.chosen ? 0 : layout.width * focus));
        const y = stage.y + Math.abs(distance) * 12 - (1 - focus) * 12;
        pack.root.visible = !(active && (!pose.chosen || motion.drop >= 1)) && (pose.chosen || focus < .995);
        pack.root.position.set(x, layout.height / 2 - y - (pose.chosen ? motion.sleeveY * stage.width : 0), 500 - Math.abs(distance) * 120);
        pack.root.scale.setScalar(scale * (1 + (pose.chosen ? motion.load * .014 : 0)));
        pack.root.rotation.set(0, pose.rotation - Math.sin(angle) * .43 * (1 - focus), -Math.sin(angle) * .045 * (1 - focus));
        pack.deform(pose.chosen ? motion.tear : 0, pose.chosen ? motion.mouth : 0);
        if (pose.chosen) {
          selectedWidth = scale;
          const exit = motion.stripExit;
          pack.strip.visible = exit < 1;
          // A detached foil seal loses its pull and tumbles beside the pack.
          // Sending it across the entire viewport made the tear read as a UI
          // swipe rather than a small piece of packaging coming loose.
          pack.strip.position.set(exit * (.28 + .93 * exit),
            (.08 * Math.sin(Math.PI * exit) - .47 * exit ** 2) * PRO_PACK_VERTICAL_SCALE, exit * .34);
          pack.strip.rotation.set(exit * .43, exit * .22, -exit * .8);
        } else { pack.strip.visible = true; pack.strip.position.set(0, 0, 0); pack.strip.rotation.set(0, 0, 0); }
      });
      return { ...stage, width: selectedWidth, height: selectedWidth * PRO_PACK_ASPECT,
        y: stage.y - (1 - carousel.pose(carousel.selected).focus) * 12, opacity: 1 - motion.drop };
    },
    dispose() { root.removeFromParent(); packs.forEach(pack => pack.dispose()); materials.dispose(); },
  };
}
