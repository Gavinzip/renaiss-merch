import { smooth, type CardTarget } from './ceremonyTimeline';

// The flight owns this shadow only until landing. The DOM faces then own it,
// so the shadow follows the card's perspective during a click-to-flip.
export function createRewardLandingShadow(root: HTMLElement) {
  const face = root.querySelector<HTMLElement>('.renaiss-reward-card .surf-batch-card__face')!;
  const style = getComputedStyle(face), shadow = document.createElement('div');
  shadow.setAttribute('aria-hidden', 'true');
  Object.assign(shadow.style, {
    position: 'absolute', pointerEvents: 'none', zIndex: '2',
    boxShadow: style.boxShadow, borderRadius: style.borderRadius,
    transformOrigin: 'center', visibility: 'hidden',
  });
  root.append(shadow); root.dataset.landingShadow = 'true';
  return {
    render(target: CardTarget | undefined, pose: { x: number; y: number; scale: number; rz: number }, progress: number, parked = false) {
      root.dataset.landingShadow = String(!parked);
      shadow.style.visibility = target && progress > 0 && !parked ? 'visible' : 'hidden';
      if (!target || parked) return;
      Object.assign(shadow.style, {
        left: `${pose.x - target.width / 2}px`, top: `${pose.y - target.height / 2}px`,
        width: `${target.width}px`, height: `${target.height}px`,
        opacity: String(smooth(progress)), transform: `rotate(${-pose.rz}rad) scale(${pose.scale})`,
      });
    },
    dispose() { shadow.remove(); delete root.dataset.landingShadow; },
  };
}
