import { PRO_PACK_ASPECT, PRO_PACK_VERTICAL_SCALE } from './proBoosterDimensions';
import * as THREE from 'three';
import type { CeremonyArtwork } from './ceremonyArtwork';
import { proBoosterLayout, proBoosterMotion, proAgeForTear } from './proBoosterTimeline';
import { createProBoosterMaterials } from './proBoosterMaterials';
import { createProFoilPack } from './createProFoilPack';
import { createProBoosterCarousel, PRO_PACK_COUNT, packOrbit } from './proBoosterCarousel';
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
      const base = proBoosterLayout(layout);
      const stage = art.brand === 'renaiss' ? { ...base, width: base.width * .88, height: base.height * .88, y: base.y + base.height * .05 } : base;
      const active = phase === 'settling' && opened;
      const motion = proBoosterMotion(active ? age : proAgeForTear(preview));
      root.visible = (phase === 'idle' || phase === 'spinning' || phase === 'settling') && !reduced;
      let selectedWidth = stage.width * .8;
      packs.forEach((pack, index) => {
        const pose = carousel.pose(index), distance = pose.distance;
        const angle = distance * Math.PI * 2 / PRO_PACK_COUNT;
        const focus = pose.focus, width = stage.width * (.80 + .20 * focus);
        const orbit = packOrbit(distance);
        const scale = width * orbit.scale * (pose.chosen ? 1 : 1 - .2 * focus);
        const x = orbit.x / 1.04 * (stage.width * 1.04 + (pose.chosen ? 0 : layout.width * focus));
        const y = stage.y + orbit.lower * stage.height * .8 * (1 - focus) - (1 - focus) * 12;
        pack.root.visible = !(active && (!pose.chosen || motion.drop >= 1)) && (pose.chosen || focus < .995);
        pack.root.position.set(x, layout.height / 2 - y - (pose.chosen ? motion.sleeveY * stage.width : 0), 500 - orbit.depth * 380);
        pack.root.scale.setScalar(scale * (1 + (pose.chosen ? motion.load * .014 : 0)));
        pack.root.rotation.set(0, pose.rotation - Math.sin(angle) * .43 * (1 - focus), -Math.sin(angle) * .045 * (1 - focus));
        pack.deform(pose.chosen ? motion.tear : 0, pose.chosen ? motion.mouth : 0, pose.chosen ? motion.stripExit : 0);
        if (pose.chosen) {
          selectedWidth = scale;
          const exit = motion.stripExit;
          pack.strip.visible = exit < 1;
          // A detached foil seal loses its pull and tumbles beside the pack.
          // Sending it across the entire viewport made the tear read as a UI
          // swipe rather than a small piece of packaging coming loose.
          pack.strip.position.set(exit * (.10 + .68 * exit),
            (.09 * Math.sin(Math.PI * exit) - 2.7 * exit ** 2) * PRO_PACK_VERTICAL_SCALE, exit * .34);
          pack.strip.rotation.set(exit * .7, exit * .35, -exit * .58);
        } else { pack.strip.visible = true; pack.strip.position.set(0, 0, 0); pack.strip.rotation.set(0, 0, 0); }
      });
      return { ...stage, width: selectedWidth, height: selectedWidth * PRO_PACK_ASPECT,
        y: stage.y - (1 - carousel.pose(carousel.selected).focus) * 12, opacity: 1 - motion.drop };
    },
    dispose() { root.removeFromParent(); packs.forEach(pack => pack.dispose()); materials.dispose(); },
  };
}
