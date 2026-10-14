import { hubPreviewWordmarkUrl, surfPreviewLogoUrl } from '../RenaissHub/hubPreviewAssets';

export type SurfProLogoUrls = { surf: string; renaiss: string };
export type SurfProArtworkProgress = { percent: number; stage: 'download' | 'decode' | 'render' };

export function artworkAborted(signal: AbortSignal) {
  return new Promise<never>((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

function textureUrl(url: string) {
  if (import.meta.env.DEV) return url;
  // The same CDN artwork is also rendered by ordinary <img> tags. R2 omits
  // Vary: Origin on those no-Origin responses, so an HTTP cache may reuse one
  // for a later CORS fetch. Give canvas/WebGL artwork its own cache key.
  const texture = new URL(url);
  texture.searchParams.set('gpu-artwork', '1');
  return texture.href;
}

export async function prepareSurfProLogos(signal: AbortSignal, onProgress: (progress: SurfProArtworkProgress) => void): Promise<SurfProLogoUrls> {
  const assets = [surfPreviewLogoUrl(), hubPreviewWordmarkUrl()].map(textureUrl);
  const objectUrls: string[] = [];
  try {
    const responses = await Promise.all(assets.map(url => fetch(url, { signal })));
    if (responses.some(response => !response.ok || !response.body || !response.headers.get('content-type')?.startsWith('image/'))) {
      throw new Error('surf_partner_logo_unavailable');
    }
    const lengths = responses.map(response => Number(response.headers.get('content-length')));
    const received = [0, 0];
    const measurable = lengths.every(length => Number.isFinite(length) && length > 0);
    const total = lengths.reduce((sum, length) => sum + length, 0);
    const blobs = await Promise.all(responses.map(async (response, index) => {
      const reader = response.body!.getReader();
      const chunks: BlobPart[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        signal.throwIfAborted();
        received[index] += value.byteLength;
        chunks.push(new Uint8Array(value));
        if (measurable) onProgress({ percent: Math.min(80, Math.floor(received.reduce((sum, size) => sum + size, 0) / total * 80)), stage: 'download' });
      }
      if (!received[index] || (lengths[index] > 0 && received[index] !== lengths[index])) throw new Error('surf_partner_logo_incomplete');
      return new Blob(chunks, { type: response.headers.get('content-type')! });
    }));
    signal.throwIfAborted();
    blobs.forEach(blob => objectUrls.push(URL.createObjectURL(blob)));
    onProgress({ percent: 86, stage: 'decode' });
    const images = objectUrls.map(url => { const image = new Image(); image.src = url; return image; });
    await Promise.race([Promise.all([...images.map(image => image.decode()), document.fonts.ready]), artworkAborted(signal)]);
    signal.throwIfAborted();
    return { surf: objectUrls[0], renaiss: objectUrls[1] };
  } catch (error) {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    throw error;
  }
}
