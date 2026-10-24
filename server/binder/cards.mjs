import { HttpError } from '../http.mjs';

const endpoint = 'https://www.renaiss.xyz/api/trpc/collectible.list';
const tokenPattern = /^(0|[1-9]\d{0,77})$/;
const imageOrigin = 'https://8nothtoc5ds7a0x3.public.blob.vercel-storage.com';
const pending = new Map();
const snapshots = new Map();

// This is the same user-scoped public query used by the Renaiss binder drawer.
// Identity comes exclusively from the verified session, never request input.
export function readOwnedCards(session, { maxAgeMs = 0 } = {}) {
  const key = JSON.stringify([session?.user?.sub, session?.user?.safeWalletAddress, session?.user?.legacyWalletAddress]);
  const snapshot = snapshots.get(key);
  if (maxAgeMs > 0 && snapshot && Date.now() - snapshot.checkedAt < Math.min(maxAgeMs, 30000))
    return Promise.resolve(snapshot.cards);
  if (pending.has(key)) return pending.get(key);
  if (pending.size >= 128) throw new HttpError(503, 'binder_cards_busy');
  const request = loadOwnedCards(session).then(cards => {
    if (snapshots.size >= 128) snapshots.delete(snapshots.keys().next().value);
    snapshots.set(key, { cards, checkedAt: Date.now() });
    return cards;
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
async function loadOwnedCards(session) {
  const user = session?.user;
  if (!user?.sub || user.isDemo) throw new HttpError(401, 'authentication_required');
  const wallets = new Set([user.safeWalletAddress, user.legacyWalletAddress].filter(Boolean).map(w => w.toLowerCase()));
  if (!wallets.size) throw new HttpError(409, 'safe_wallet_not_ready');
  const cards = [], seen = new Set();
  const signal = AbortSignal.timeout(20000);
  for (let offset = 0; offset < 5000; offset += 50) {
    const url = new URL(endpoint);
    url.searchParams.set('input', JSON.stringify({ json: { userId: user.sub, limit: 50, offset, sortBy: 'name', sortOrder: 'asc' } }));
    let response, body;
    try {
      response = await fetch(url, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
      body = await response.json();
    } catch { throw new HttpError(502, 'binder_cards_load_failed'); }
    const data = body?.result?.data?.json;
    if (!response.ok || !Array.isArray(data?.collection) || !data.pagination || data.pagination.offset !== offset)
      throw new HttpError(502, 'binder_cards_load_failed');
    for (const card of data.collection) {
      const id = String(card.tokenId);
      if (!tokenPattern.test(id) || BigInt(id) >= 2n ** 256n || seen.has(id) || typeof card.name !== 'string' || !wallets.has(String(card.ownerAddress).toLowerCase()))
        throw new HttpError(502, 'binder_card_ownership_mismatch');
      let image;
      try { image = new URL(card.frontImageUrl); } catch { throw new HttpError(502, 'binder_card_image_missing'); }
      if (image.origin !== imageOrigin || !image.pathname.startsWith('/graded-cards-renders/'))
        throw new HttpError(502, 'binder_card_image_invalid');
      seen.add(id);
      cards.push({ tokenId: `card:${id}`, name: card.name, description: [card.setName, card.gradingCompany, card.grade].filter(Boolean).join(' · '),
        howToEarn: '', balance: 1, imageUrl: `/api/binder/card-media?tokenId=${id}`,
        card: { tokenId: id, setName: card.setName || '', gradingCompany: card.gradingCompany || '', grade: card.grade || '' },
        sourceImageUrl: image.href });
    }
    if (data.pagination.hasMore === false) return cards;
    if (data.collection.length !== 50) throw new HttpError(502, 'binder_cards_pagination_invalid');
  }
  throw new HttpError(502, 'binder_cards_inventory_limit');
}

export function publicCardMetadata({ sourceImageUrl, ...card }) { return card; }
