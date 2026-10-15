import type { CeremonyArtwork } from './ceremonyArtwork';

// Measure the actual card typography instead of maintaining a second layout.
export function paintRenaissReward(element: HTMLElement, art: CeremonyArtwork) {
  const face = element.querySelector<HTMLElement>('.surf-batch-card__face--ticket')!;
  const bounds = face.getBoundingClientRect(), ratio = Math.min(3, 1800 / bounds.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(bounds.width * ratio); canvas.height = Math.ceil(bounds.height * ratio);
  const pen = canvas.getContext('2d');
  if (!pen) throw new Error('Renaiss reward print unavailable');
  pen.scale(ratio, ratio);
  // Opaque card stock under the SVG's transparent rounded corners.
  pen.fillStyle = '#f7f7f5'; pen.fillRect(0, 0, bounds.width, bounds.height);
  pen.drawImage(art.rewardSurface, 0, 0, bounds.width, bounds.height);
  const logo = face.querySelector<HTMLElement>('.hub-brand-wordmark')!.getBoundingClientRect();
  pen.drawImage(art.renaiss, logo.left - bounds.left, logo.top - bounds.top, logo.width, logo.height);
  for (const node of face.querySelectorAll<HTMLElement>('[data-card-print]')) {
    const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
    pen.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
    pen.letterSpacing = css.letterSpacing === 'normal' ? '0px' : css.letterSpacing;
    pen.fillStyle = css.color; pen.textBaseline = 'middle';
    pen.textAlign = css.textAlign === 'center' ? 'center' : 'left';
    pen.fillText(node.textContent || '', rect.left - bounds.left + (pen.textAlign === 'center' ? rect.width / 2 : 0),
      rect.top - bounds.top + rect.height / 2);
  }
  return canvas;
}
