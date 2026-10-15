import type { CeremonyArtwork } from '../../RenaissHub/draw-effects/batch-ceremony/ceremonyArtwork';
import { paintRenaissReward } from '../../RenaissHub/draw-effects/batch-ceremony/paintRenaissReward';

function canvas() {
  const node = document.createElement('canvas'), pen = node.getContext('2d');
  if (!pen) throw new Error('Card foil compositor unavailable');
  return { node, pen };
}

// The shader is spot-printed through the actual wordmark alpha. Both the DOM
// overlay and the moving Three.js print use these exact pixels.
export function createCardFoilPrint(card: HTMLElement, art: CeremonyArtwork) {
  const print = canvas(), light = canvas();
  const faces = [...card.querySelectorAll<HTMLElement>('.surf-batch-card__face')].map(face => {
    const overlay = face.querySelector<HTMLCanvasElement>('.renaiss-reward-card__spot-foil')!;
    const pen = overlay.getContext('2d');
    if (!pen) throw new Error('Card foil overlay unavailable');
    return { face, overlay, pen, mask: canvas() };
  });
  let stock: HTMLCanvasElement;
  function resize() {
    stock = paintRenaissReward(card, art);
    const { width, height } = stock;
    for (const target of [print.node, light.node, ...faces.flatMap(face => [face.overlay, face.mask.node])]) {
      target.width = width; target.height = height;
    }
    for (const { face, mask } of faces) {
      const logo = face.querySelector<HTMLImageElement>('.hub-brand-wordmark')!;
      // Offset coordinates remain stable while the face is rotating in 3D.
      let x = 0, y = 0, parent: HTMLElement | null = logo;
      while (parent && parent !== face) { x += parent.offsetLeft; y += parent.offsetTop; parent = parent.offsetParent as HTMLElement | null; }
      const scale = width / face.offsetWidth;
      mask.pen.save(); mask.pen.scale(scale, scale);
      // Preserve the full-colour brand icon; foil only the dark wordmark.
      mask.pen.beginPath(); mask.pen.rect(x + logo.offsetWidth * .19, y, logo.offsetWidth * .81, logo.offsetHeight); mask.pen.clip();
      mask.pen.drawImage(art.renaiss, x, y, logo.offsetWidth, logo.offsetHeight);
      mask.pen.restore();
    }
  }
  function compose(field: HTMLCanvasElement) {
    const { width, height } = print.node;
    light.pen.clearRect(0, 0, width, height);
    light.pen.drawImage(field, 0, 0, width, height);
    light.pen.globalCompositeOperation = 'source-in';
    light.pen.fillStyle = '#ffffff'; light.pen.fillRect(0, 0, width, height);
    light.pen.globalCompositeOperation = 'source-over';
    for (const { pen, mask } of faces) {
      pen.clearRect(0, 0, width, height);
      pen.drawImage(field, 0, 0, width, height);
      pen.globalCompositeOperation = 'destination-in'; pen.drawImage(mask.node, 0, 0);
      pen.globalCompositeOperation = 'source-over';
      // The same shader light adds a very low exposure across the matte stock.
      pen.globalAlpha = .12; pen.drawImage(light.node, 0, 0); pen.globalAlpha = 1;
    }
    print.pen.clearRect(0, 0, width, height);
    print.pen.drawImage(stock, 0, 0); print.pen.drawImage(faces[0].overlay, 0, 0);
  }
  resize();
  return { canvas: print.node, resize, compose };
}
