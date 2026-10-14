import * as THREE from 'three';
import { stockMarkPaths } from './stockMarkPaths';

export function printTexture(text: string, spaced = false) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const pen = canvas.getContext('2d'); if (!pen) throw new Error('Surf model print surface unavailable');
  pen.fillStyle = '#f4f3f2'; pen.textAlign = 'center'; pen.textBaseline = 'middle'; pen.font = `${spaced ? '600 124' : '650 145'}px Inter, Arial, sans-serif`;
  if (spaced) pen.letterSpacing = '24px';
  pen.fillText(text, 512, 132);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; return texture;
}
const faces = [
  { id: 'nvidia', color: '#65a909', ink: '#ffffff' }, { id: '500', color: '#e81725', ink: '#ffffff' }, { id: 'apple', color: '#141519', ink: '#ffffff' }, { id: 'microsoft', color: '#fbfbf8', ink: '#ffffff' },
  { id: 'google', color: '#ffffff', ink: '#4285f4' }, { id: 'meta', color: '#ffffff', ink: '#0866ff' }, { id: 'QQQ', color: '#ffffff', ink: '#234f90' }, { id: 'amazon', color: '#ffffff', ink: '#16161b' },
  { id: 'tesla', color: '#e81725', ink: '#ffffff' }, { id: 'amd', color: '#fbfbf8', ink: '#18191b' }, { id: 'MicroStrategy', color: '#e81725', ink: '#ffffff' }, { id: 'x', color: '#111217', ink: '#ffffff' }
];
export function stockFaceTexture(index: number) {
  const face = faces[index], canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const pen = canvas.getContext('2d'); if (!pen) throw new Error('Stock token face unavailable');
  pen.fillStyle = face.color; pen.fillRect(0,0,512,512); pen.fillStyle = face.ink;
  if (stockMarkPaths[face.id]) {
    pen.save(); pen.translate(102, 96); pen.scale(308 / 24, 308 / 24); pen.fill(new Path2D(stockMarkPaths[face.id])); pen.restore();
    if (face.id === 'nvidia') { pen.font = '700 58px Arial'; pen.textAlign = 'center'; pen.fillText('NVIDIA',256,436); }
  } else if (face.id === 'microsoft') {
    for (const [i, color] of ['#f35325','#81bc06','#05a6f0','#ffba08'].entries()) { pen.fillStyle = color; pen.fillRect(115 + (i % 2) * 146,115 + Math.floor(i / 2) * 146,132,132); }
  } else if (face.id === 'amazon') {
    pen.textAlign = 'center'; pen.font = '700 390px Arial'; pen.fillText('a',256,358);
    pen.strokeStyle = '#f59b21'; pen.lineWidth = 15; pen.lineCap = 'round'; pen.beginPath(); pen.moveTo(116,381); pen.quadraticCurveTo(260,467,401,374); pen.stroke();
  } else {
    pen.textAlign = 'center'; pen.textBaseline = 'middle'; pen.font = face.id === '500' ? 'italic 700 205px Arial' : face.id === 'QQQ' ? '700 148px Arial' : '600 53px Arial'; pen.fillText(face.id,256,270);
    if (face.id === 'QQQ') { pen.font = '600 48px Arial'; pen.fillText('Invesco',256,155); }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; return texture;
}
