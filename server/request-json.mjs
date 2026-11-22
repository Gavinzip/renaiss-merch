import { HttpError } from './http.mjs';

// Vercel provides a parsed body; the standalone Node server provides a stream.
// Keep the same JSON and byte-limit contract on both normal server entries.
export async function readJsonBody(req, maxBytes = 16 * 1024) {
  if (Number(req.headers?.['content-length']) > maxBytes)
    throw new HttpError(413, 'request_too_large');
  let body;
  try { body = req.body; }
  catch { throw new HttpError(400, 'invalid_json'); }
  if (body !== undefined) {
    if (typeof body === 'string' || Buffer.isBuffer(body)) return parse(body);
    let encoded;
    try { encoded = JSON.stringify(body); }
    catch { throw new HttpError(400, 'invalid_json'); }
    if (encoded === undefined) throw new HttpError(400, 'invalid_json');
    checkSize(Buffer.byteLength(encoded));
    return body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    checkSize(size);
    chunks.push(bytes);
  }
  if (!size) throw new HttpError(400, 'request_body_required');
  return parse(Buffer.concat(chunks));

  function checkSize(bytes) {
    if (bytes > maxBytes) throw new HttpError(413, 'request_too_large');
  }
  function parse(value) {
    checkSize(Buffer.byteLength(value));
    try { return JSON.parse(value.toString()); }
    catch { throw new HttpError(400, 'invalid_json'); }
  }
}
