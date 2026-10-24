import { HttpError } from '../http.mjs';
import { createPrivateMediaSignedUrl } from '../private-media-signed-url.mjs';
import { readOwnedCards } from './cards.mjs';

// Only metadata/control requests pass through the app. Image bytes travel
// upstream -> Cloudflare R2 -> browser, never through Node/Vercel/Zeabur.
export async function redirectOwnedCardMedia(res, session, tokenId) {
  if (!/^(0|[1-9]\d{0,77})$/.test(tokenId || '')) throw new HttpError(400, 'invalid_card_id');
  // A short scoped proof avoids repeating full inventory scans for each mounted
  // image. Library refresh and Save still query the provider afresh.
  const cards = await readOwnedCards(session, { maxAgeMs: 30000 });
  const card = cards.find(c => c.card.tokenId === tokenId);
  if (!card) throw new HttpError(403, 'binder_card_not_owned');
  const origin = process.env.PRIVATE_MEDIA_ORIGIN?.trim().replace(/\/+$/, '');
  const signingSecret = process.env.PRIVATE_MEDIA_PROXY_TOKEN?.trim();
  if (!origin || !signingSecret) throw new HttpError(503, 'binder_card_media_not_configured');
  const response = await fetch(`${origin}/prepare-binder-card`, {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${signingSecret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceUrl: card.sourceImageUrl }),
  });
  if (!response.ok) throw new HttpError(502, 'binder_card_media_prepare_failed');
  const value = await response.json();
  if (!/^merch\/v1\.2\/binder-cards\/[a-f0-9]{64}\.image$/.test(value.key || ''))
    throw new HttpError(502, 'binder_card_media_invalid');
  res.writeHead(307, { 'Cache-Control': 'private, no-store', Vary: 'Cookie',
    Location: createPrivateMediaSignedUrl({ remoteUrl: `${origin}/${value.key}`, signingSecret }) });
  res.end();
}
