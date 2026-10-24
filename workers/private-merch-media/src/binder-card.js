const SOURCE_ORIGIN = 'https://8nothtoc5ds7a0x3.public.blob.vercel-storage.com';
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export async function prepareBinderCard(request, bucket) {
  try {
    if (Number(request.headers.get('Content-Length')) > 2048) return fail(413);
    const raw = await request.text();
    if (raw.length > 2048) return fail(413);
    const source = new URL(JSON.parse(raw).sourceUrl);
    if (source.origin !== SOURCE_ORIGIN || !source.pathname.startsWith('/graded-cards-renders/') || source.username || source.password || source.search || source.hash)
      return fail(400);
    const head = await fetch(source, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const etag = head.headers.get('ETag'), type = head.headers.get('Content-Type')?.split(';')[0];
    const length = Number(head.headers.get('Content-Length'));
    if (!head.ok || !etag || !TYPES.has(type) || !Number.isSafeInteger(length) || length < 1 || length > 20 * 1024 * 1024)
      return fail(502);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source.href + '\n' + etag));
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    const key = `merch/v1.2/binder-cards/${hash}.image`;
    if (!await bucket.head(key)) {
      const image = await fetch(source, { redirect: 'manual', headers: { 'If-Match': etag }, signal: AbortSignal.timeout(15000) });
      if (!image.ok || image.headers.get('ETag') !== etag || image.headers.get('Content-Type')?.split(';')[0] !== type || Number(image.headers.get('Content-Length')) !== length)
        return fail(502);
      await bucket.put(key, image.body, { httpMetadata: { contentType: type, cacheControl: 'private, no-store' } });
    }
    return Response.json({ key }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return fail(502); }
}
function fail(status) { return new Response('Card media preparation failed.', { status, headers: { 'Cache-Control': 'no-store' } }); }
