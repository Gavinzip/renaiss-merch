export type SurfDrawMediaState = {
  stage: 'download' | 'decode' | 'render'; percent: number; ready: boolean; error: boolean;
};
export const surfDrawMediaInitial: SurfDrawMediaState = { stage: 'download', percent: 0, ready: false, error: false };

export async function downloadSurfDrawAtlas(url: string, bytes: number, signal: AbortSignal, progress: (received: number) => void) {
  const response = await fetch(url, { signal, credentials: 'same-origin' });
  if (!response.ok || !response.body || !response.headers.get('content-type')?.startsWith('image/webp')) {
    throw new Error('surf_draw_atlas_unavailable');
  }
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    signal.throwIfAborted();
    chunks.push(new Uint8Array(value));
    received += value.byteLength;
    progress(received);
  }
  if (received !== bytes) throw new Error('surf_draw_atlas_incomplete');
  return new Blob(chunks, { type: 'image/webp' });
}
