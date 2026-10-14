import * as THREE from 'three';

export const FILM_BOX_ATLAS = {
  file: 'surf-film-box-uv-46b9cb44c74d.webp', bytes: 330644, size: 2048,
  regions: {
    frontBase: [4,4,1016,504], backBase: [1028,4,1016,504],
    frontLid: [4,516,1016,248], backLid: [1028,516,1016,248],
    rightBase: [4,772,504,504], leftBase: [516,772,504,504],
    rightLid: [4,1284,504,248], leftLid: [516,1284,504,248],
    top: [1028,772,1016,648], lining: [4,1540,1016,504],
  },
} as const;
export type FilmBoxFace = keyof typeof FILM_BOX_ATLAS.regions;

export function filmBoxUV(face: FilmBoxFace, u: number, v: number) {
  const [x,y,w,h] = FILM_BOX_ATLAS.regions[face];
  return [(x + .5 + u * (w - 1)) / FILM_BOX_ATLAS.size, 1 - (y + .5 + (1 - v) * (h - 1)) / FILM_BOX_ATLAS.size];
}

// The local derivative is served by Vite from work/. Production has no local
// media fallback: this exact version must be published directly to the CDN.
export async function loadFilmBoxAtlas(signal: AbortSignal) {
  const cdn = String(import.meta.env.VITE_STATIC_ASSET_CDN_BASE_URL || '').replace(/\/+$/, '');
  if (!import.meta.env.DEV && !cdn) throw new Error('Surf box UV CDN is not configured.');
  const url = import.meta.env.DEV
    ? `/work/assets/surf/film-box-uv-v2/${FILM_BOX_ATLAS.file}`
    : `${cdn}/merch/surf-draw/film-box-uv-v2/${FILM_BOX_ATLAS.file}`;
  const response = await fetch(url, { signal });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/webp')) throw new Error('Surf box UV artwork is unavailable.');
  const blob = await response.blob(); signal.throwIfAborted();
  if (blob.size !== FILM_BOX_ATLAS.bytes) throw new Error('Surf box UV artwork is incomplete.');
  const image = await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  if (signal.aborted) { image.close(); signal.throwIfAborted(); }
  return image;
}

export function filmBoxAtlasTexture(image: ImageBitmap) {
  const texture = new THREE.Texture(image);
  texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8; texture.needsUpdate = true;
  return texture;
}
