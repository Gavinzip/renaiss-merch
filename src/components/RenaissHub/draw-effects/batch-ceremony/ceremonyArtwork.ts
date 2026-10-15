import * as THREE from 'three';
import { paintSurfDrawBox, surfBoxMotion } from '../surfDrawBoxFrames';
import { renaissDrawArtwork } from './renaissDrawArtwork';
import { renaissRewardBackSurfaceUrl } from '../../../RosterDraw/renaissRewardSurface';
import { paintRenaissReward } from './paintRenaissReward';

export type CeremonyArtwork = { renaiss: HTMLImageElement; surf: HTMLImageElement; rewardSurface: HTMLImageElement; box: HTMLCanvasElement; brand?: 'surf' | 'renaiss' };
export async function prepareCeremonyArtwork(logos: { renaiss: string; surf: string }, images: ImageBitmap[]) {
  const renaiss = new Image(), surf = new Image(); renaiss.src = logos.renaiss; surf.src = logos.surf;
  const rewardSurface = new Image(); rewardSurface.src = renaissRewardBackSurfaceUrl;
  await Promise.all([renaiss.decode(), surf.decode(), rewardSurface.decode(), document.fonts.ready]);
  const box = document.createElement('canvas'); box.width = box.height = 384;
  const pen = box.getContext('2d'); if (!pen) throw new Error('Batch artwork canvas is unavailable');
  pen.scale(384 / surfBoxMotion.tile, 384 / surfBoxMotion.tile); paintSurfDrawBox(pen, images, surfBoxMotion.frames - 1);
  return { renaiss, surf, box, rewardSurface };
}
function canvas(width = 640, height = 400) {
  const node = document.createElement('canvas'); node.width = width; node.height = height;
  const pen = node.getContext('2d'); if (!pen) throw new Error('Batch card texture could not prepare');
  return { node, pen };
}
function surface(pen: CanvasRenderingContext2D, w: number, h: number) {
  const metal = pen.createLinearGradient(0, 0, w, h);
  [[0, '#fffdf9'], [.22, '#eef0f3'], [.54, '#fffaf3'], [1, '#e9e5ef']].forEach(([at, color]) => metal.addColorStop(Number(at), String(color)));
  pen.fillStyle = metal; pen.fillRect(0, 0, w, h);
  pen.strokeStyle = '#bfc3c8'; pen.lineWidth = 1; pen.beginPath(); pen.roundRect(6, 6, w - 12, h - 12, 13); pen.stroke();
  pen.strokeStyle = '#ffffff'; pen.beginPath(); pen.roundRect(9, 9, w - 18, h - 18, 11); pen.stroke();
  for (let y = 0; y < h; y += 3) { pen.fillStyle = y % 2 ? '#ffffff22' : '#6c718105'; pen.fillRect(0, y, w, 1); }
}
function cardSurface(pen: CanvasRenderingContext2D, w: number, h: number, pro = false) {
  const metal = pen.createLinearGradient(0, 0, w, h);
  (pro ? [[0, '#fffdfa'], [.28, '#eff3ee'], [.56, '#fffcf3'], [1, '#e5efea']]
    : [[0, '#fffdf9'], [.22, '#eef0f3'], [.54, '#fffaf3'], [1, '#e9e5ef']])
    .forEach(([at, color]) => metal.addColorStop(Number(at), String(color)));
  pen.fillStyle = metal; pen.fillRect(0, 0, w, h);
  pen.strokeStyle = '#ffffff'; pen.lineWidth = 1;
  pen.beginPath(); pen.roundRect(.5, .5, w - 1, h - 1, 13); pen.stroke();
}
export function cardBack(art: CeremonyArtwork, ticket?: string, slot?: string) {
  if (art.brand === 'renaiss') return renaissDrawArtwork(art.renaiss);
  // The moving face is still a texture. Rasterize above the largest settled
  // card's screen size so it stays legible during the turn on a Retina display.
  const { node, pen } = canvas(960, 600); pen.scale(1.5, 1.5); surface(pen, 640, 400);
  pen.drawImage(art.renaiss, 139, ticket ? 119 : 165, 240, 59);
  pen.fillStyle = '#b0a6b5'; pen.font = '28px Inter, sans-serif'; pen.fillText('×', 399, ticket ? 158 : 204);
  pen.drawImage(art.surf, 443, ticket ? 123 : 169, 52, 52);
  pen.textAlign = 'center'; pen.fillStyle = '#958a9f'; pen.font = '13px Inter, sans-serif';
  pen.fillText('RENAISS × SURF', 320, 348);
  if (ticket) {
    pen.font = '11px Inter, sans-serif'; pen.fillText('WINNING TICKET', 320, 215);
    pen.font = '500 42px Inter, sans-serif'; pen.fillStyle = '#554a60'; pen.fillText(ticket, 320, 266);
  }
  if (slot) { pen.textAlign = 'right'; pen.font = '13px Inter, sans-serif'; pen.fillStyle = '#9e94a8'; pen.fillText(slot, 597, 39); }
  return node;
}
export function credential(art: CeremonyArtwork, duration: string) {
  if (art.brand === 'renaiss') return renaissDrawArtwork(art.renaiss);
  // Render at twice the SVG's intrinsic size. The card is the hero object in
  // the ceremony, so its typography and foil lines must survive a Retina view.
  const { node, pen } = canvas(1440, 944); pen.scale(2, 2);
  const metal = pen.createLinearGradient(0, 0, 720, 380);
  [[0, '#fbfcf9'], [.24, '#e9ebe9'], [.46, '#fffdf7'], [.7, '#dfe5e3'], [1, '#f4f2ee']]
    .forEach(([at, color]) => metal.addColorStop(Number(at), String(color)));
  // Three.js uses an opaque print face. Cover the entire texture so its
  // corners do not expose the renderer's black clear color as a fake border.
  pen.fillStyle = metal; pen.fillRect(0, 0, 720, 472);
  pen.strokeStyle = '#b4c0b9'; pen.lineWidth = 1.4;
  pen.beginPath(); pen.roundRect(7, 7, 706, 458, 20); pen.stroke();
  pen.save(); pen.beginPath(); pen.roundRect(7, 7, 706, 458, 20); pen.clip();
  const shine = pen.createLinearGradient(70, 0, 540, 420);
  shine.addColorStop(0, '#ffffff00'); shine.addColorStop(.47, '#ffffff00');
  shine.addColorStop(.53, '#ffffff85'); shine.addColorStop(.59, '#ffffff00');
  pen.fillStyle = shine; pen.fillRect(0, 0, 720, 472);
  pen.strokeStyle = '#91aba044'; pen.lineWidth = 1.1;
  for (let i = 0; i < 7; i++) { pen.beginPath(); pen.moveTo(380 + i * 18, 440); pen.bezierCurveTo(355 + i * 16, 350, 655 + i * 17, 350, 635 + i * 18, 235); pen.bezierCurveTo(620 + i * 18, 175, 565 + i * 17, 85, 715 + i * 15, 10); pen.stroke(); }
  pen.restore();
  pen.drawImage(art.surf, 65, 60, 56, 56);
  pen.fillStyle = '#526b60'; pen.textAlign = 'right'; pen.font = '600 11px Inter, sans-serif'; pen.fillText('RENAISS × SURF', 649, 79);
  pen.textAlign = 'left'; pen.fillStyle = '#1e3c34'; pen.font = '650 100px Inter, sans-serif'; pen.fillText('Surf Pro', 61, 258);
  pen.fillStyle = '#60766c'; pen.font = '500 12px Inter, sans-serif'; pen.fillText('PRO MEMBERSHIP', 65, 298);
  pen.fillStyle = '#2f5143'; pen.font = '450 21px Inter, sans-serif'; pen.fillText(duration, 65, 391);
  pen.strokeStyle = '#476158'; pen.lineWidth = 1.5; pen.lineCap = 'round'; pen.lineJoin = 'round';
  pen.beginPath(); pen.moveTo(604, 372); pen.lineTo(644, 372); pen.moveTo(632, 360); pen.lineTo(644, 372); pen.lineTo(632, 384); pen.stroke();
  return node;
}
// Only the in-flight ticket is rasterized. Parked cards and click turns use
// their original DOM faces, including the winner typography and prize art.
export function cardTicketBack(element: HTMLElement, art: CeremonyArtwork, pro: HTMLCanvasElement) {
  if (art.brand === 'renaiss') return paintRenaissReward(element, art);
  const bounds = element.getBoundingClientRect(), ratio = Math.min(2.5, 768 / bounds.width);
  const { node, pen } = canvas(Math.ceil(bounds.width * ratio), Math.ceil(bounds.height * ratio));
  pen.scale(ratio, ratio); cardSurface(pen, bounds.width, bounds.height, element.closest('[data-kind=surf-pro-month]') !== null);
  function rect(selector: string) {
    const el = element.querySelector<HTMLElement>(selector)!; const b = el.getBoundingClientRect();
    return { el, x: b.left - bounds.left, y: b.top - bounds.top, w: b.width, h: b.height };
  }
  for (const [selector, image] of [['.surf-batch-card__top .hub-brand-wordmark', art.renaiss], ['.surf-batch-card__top .hub-surf-logo', art.surf]] as const) {
    if (!element.querySelector(selector)) continue;
    const r = rect(selector); pen.drawImage(image, r.x, r.y, r.w, r.h);
  }
  for (const selector of ['.surf-batch-card__top > b', '.surf-batch-card__top > span', '.surf-batch-card__identity > span', '.surf-batch-card__ticket', '.surf-batch-card__bottom > span']) {
    if (!element.querySelector(selector)) continue;
    const r = rect(selector), css = getComputedStyle(r.el);
    pen.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`; pen.fillStyle = css.color; pen.textBaseline = 'top';
    const label = r.el.textContent;
    pen.fillText(label || '', r.x, r.y + Math.max(0, (r.h - parseFloat(css.fontSize)) / 2));
  }
  const prize = rect('.surf-batch-card__prize');
  if (element.querySelector('.surf-batch-card__prize canvas')) {
    const r = rect('.surf-batch-card__prize canvas'); pen.drawImage(art.box, r.x, r.y, r.w, r.h);
  } else { pen.save(); pen.translate(prize.x + prize.w / 2, prize.y + prize.h / 2); pen.rotate(-8 * Math.PI / 180); pen.drawImage(pro, -prize.w / 2, -prize.w * 472 / 1440, prize.w, prize.w * 472 / 720); pen.restore(); }
  const footer = rect('.surf-batch-card__bottom'); pen.strokeStyle = '#97869f44'; pen.setLineDash([3, 3]); pen.beginPath(); pen.moveTo(footer.x, footer.y); pen.lineTo(footer.x + footer.w, footer.y); pen.stroke();
  return node;
}
export function canvasTexture(image: HTMLCanvasElement, print = false) {
  const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  if (print) { texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter; }
  return texture;
}
