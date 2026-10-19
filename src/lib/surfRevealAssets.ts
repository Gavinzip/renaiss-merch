type SurfRevealAsset = 'video' | 'reverse' | 'poster';

// Only the authenticated server issues URLs. Every media body comes directly from Cloudflare.
export async function readSurfRevealMedia(signal: AbortSignal): Promise<Record<SurfRevealAsset, string>> {
  const response = await fetch('/api/surf-store/media', {
    signal, cache: 'no-store', headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`surf_reveal_authorization_${response.status}`);
  const payload = await response.json() as { assets?: Record<SurfRevealAsset, string> };
  if (!payload.assets || !(['video', 'reverse', 'poster'] as const).every(key => {
    const value = payload.assets?.[key];
    return typeof value === 'string' && new URL(value).protocol === 'https:';
  })) throw new Error('surf_reveal_manifest_invalid');
  return payload.assets;
}
