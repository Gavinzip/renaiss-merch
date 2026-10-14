import manifest from './surf-box-motion.json';
import { downloadSurfDrawAtlas, surfDrawMediaInitial, type SurfDrawMediaState } from '../surfDrawMedia';

export const surfBoxMotion = manifest;

function atlasUrl(file: string) {
  if (import.meta.env.DEV) return `/work/derived-media/surf-draw-box-alpha-v2/${file}`;
  const origin = import.meta.env.VITE_SURF_DRAW_MOTION_CDN_BASE_URL?.trim();
  if (!origin || !origin.startsWith('https://')) throw new Error('surf_draw_motion_cdn_not_configured');
  return `${origin.replace(/\/$/, '')}/${file}`;
}

export async function prepareSurfDrawBoxFrames(signal: AbortSignal, status: (state: SurfDrawMediaState) => void) {
  if (!document.createElement('canvas').getContext('2d', { alpha: true })) throw new Error('surf_draw_canvas_unavailable');
  const images: ImageBitmap[] = [];
  const total = manifest.atlases.reduce((sum, asset) => sum + asset.bytes, 0);
  let received = 0;
  try {
    for (const asset of manifest.atlases) {
      const blob = await downloadSurfDrawAtlas(atlasUrl(asset.file), asset.bytes, signal, bytes =>
        status({ ...surfDrawMediaInitial, percent: Math.floor((received + bytes) / total * 88) }));
      received += asset.bytes;
      signal.throwIfAborted();
      const bitmap = await createImageBitmap(blob);
      images.push(bitmap);
      signal.throwIfAborted();
      if (bitmap.width !== asset.columns * manifest.cellWidth || bitmap.height !== asset.rows * manifest.cellHeight) {
        throw new Error('surf_draw_atlas_dimensions_invalid');
      }
    }
    status({ ...surfDrawMediaInitial, stage: 'render', percent: 99 });
    return images;
  } catch (error) { images.forEach(image => image.close()); throw error; }
}

export function paintSurfDrawBox(context: CanvasRenderingContext2D, images: ImageBitmap[], requested: number) {
  const index = Math.max(0, Math.min(manifest.frames - 1, requested));
  let page = 0;
  let cell = index;
  while (cell >= manifest.atlases[page].frames) { cell -= manifest.atlases[page].frames; page++; }
  const columns = manifest.atlases[page].columns;
  const size = manifest.tile;
  const { cellWidth: width, cellHeight: height, offsetX, offsetY } = manifest;
  context.clearRect(0, 0, size, size);
  context.drawImage(images[page], cell % columns * width, Math.floor(cell / columns) * height, width, height, offsetX, offsetY, width, height);
  context.canvas.dataset.frame = String(index);
}
