import { PRO_PACK_ASPECT, PRO_PACK_VERTICAL_SCALE } from './proBoosterDimensions';
import type { CeremonyArtwork } from './ceremonyArtwork';

// Original Renaiss × Surf packaging, drawn at 3x display resolution. The foil's
// changing highlights come from the actual deformed metal mesh, not a video.
export function proBoosterArtwork(art: CeremonyArtwork, reverse = false) {
  const canvas = document.createElement('canvas'); canvas.width = 1050; canvas.height = Math.round(1050 * PRO_PACK_ASPECT);
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Pro booster artwork could not prepare');
  ctx.scale(3, 3);
  const y = (value: number) => value * PRO_PACK_VERTICAL_SCALE;
  const silver = ctx.createLinearGradient(0, 0, 350, y(518));
  [[0, '#dce3e1'], [.2, '#f7f7f0'], [.49, '#dce6e0'], [.68, '#f4ece1'], [1, '#d3e0df']].forEach(([p,c]) => silver.addColorStop(Number(p), String(c)));
  ctx.fillStyle = silver; ctx.fillRect(0,0,350,y(518));
  ctx.strokeStyle = '#65837925'; ctx.lineWidth = .7;
  for (let i=0; i<25; i++) {
    ctx.beginPath(); ctx.moveTo(-45+i*10,y(390)); ctx.bezierCurveTo(360+i*7,y(280),-40+i*10,y(140),375+i*9,y(56)); ctx.stroke();
  }
  for (const sealY of [0,y(493)]) {
    ctx.fillStyle='#b5c8c155'; ctx.fillRect(0,sealY,350,y(25));
    for(let x=3;x<350;x+=3) { ctx.fillStyle=x%6?'#ffffff66':'#607e7144'; ctx.fillRect(x,sealY,1,y(25)); }
  }
  ctx.strokeStyle='#fbfffbbb'; ctx.strokeRect(10,y(31),330,y(457));
  if(reverse) {
    ctx.drawImage(art.renaiss,91,y(110),168,41);
    ctx.textAlign='center'; ctx.fillStyle='#35554a'; ctx.font='500 14px Inter,sans-serif';
    ctx.fillText('A LITTLE LUCK, SHARED.',175,y(249));
    ctx.font='11px Inter,sans-serif';ctx.fillText('RENAISS × SURF',175,y(280));
    for(let i=0;i<45;i++) { ctx.fillStyle='#658074'; ctx.fillRect(90+i*3.8,y(380),i%3===0?2:1,39); }
    return canvas;
  }
  ctx.drawImage(art.renaiss,32,y(66),139,34);
  ctx.fillStyle='#82968d';ctx.font='18px Inter,sans-serif';ctx.fillText('×',188,y(66)+24);
  ctx.drawImage(art.surf,222,y(65),35,35);
  ctx.fillStyle='#567265';ctx.font='500 10px Inter,sans-serif';ctx.fillText('MEMBERSHIP COLLECTION',34,y(147));
  ctx.fillStyle='#173e32';ctx.font='500 67px Inter,sans-serif';ctx.fillText('Surf',29,y(231));
  ctx.font='600 108px Inter,sans-serif';ctx.fillText('Pro',26,y(334));
  ctx.fillStyle='#587165';ctx.font='500 11px Inter,sans-serif';ctx.fillText('ONE MONTH. ALL ACCESS.',34,y(374));
  ctx.strokeStyle='#70867a88';ctx.beginPath();ctx.moveTo(34,y(410));ctx.lineTo(316,y(410));ctx.stroke();
  ctx.font='500 9px Inter,sans-serif';ctx.fillText('OPEN YOUR NEXT CHAPTER',34,y(444));
  ctx.font='18px Inter,sans-serif';ctx.fillText('↗',300,y(448));
  ctx.font='8px Inter,sans-serif';ctx.fillStyle='#567265';ctx.fillText('RENAISS × SURF  /  LIMITED REWARD',34,y(475));
  return canvas;
}
