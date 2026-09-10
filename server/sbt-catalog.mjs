import { HttpError } from './http.mjs';

const CATALOG_PAGE = 'https://www.renaiss.xyz/profile/achievements';
const MAX_TOKEN_ID = 10000;

// This is a discovery source, not proof of ownership. Never execute remote JS.
// Re-resolve the current page's immutable bundles so new badge IDs are picked up.
export function createSbtCatalogReader({ fetchImpl = fetch, now = Date.now } = {}) {
  let cached;
  let pending;
  const inspectedBundles = new Map();

  return async function readSbtCatalog() {
    if (cached && now() - cached.loadedAt < 60000) return cached;
    if (pending) return pending;
    pending = loadCatalog().finally(() => { pending = null; });
    return pending;
  };

  async function loadCatalog() {
    const signal = AbortSignal.timeout(20000);
    const html = await readText(CATALOG_PAGE, signal);
    const paths = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)]
      .map((match) => new URL(match[1], CATALOG_PAGE))
      .filter((url) => url.origin === 'https://www.renaiss.xyz' &&
        url.pathname.startsWith('/_next/static/') && url.pathname.endsWith('.js'))
      .map((url) => url.href);
    const urls = [...new Set(paths)];
    if (!urls.length || urls.length > 150) {
      throw new HttpError(502, 'sbt_catalog_manifest_invalid');
    }

    // Keep only bundles still referenced by the current deployment.
    for (const url of inspectedBundles.keys()) {
      if (!urls.includes(url)) inspectedBundles.delete(url);
    }
    for (let index = 0; index < urls.length; index += 6) {
      const candidates = await Promise.all(urls.slice(index, index + 6).map(async (url) => {
        if (inspectedBundles.has(url)) return { url, maxTokenId: inspectedBundles.get(url) };
        const body = await readText(url, signal);
        const maxTokenId = parseSbtCatalogMaximum(body);
        inspectedBundles.set(url, maxTokenId);
        return { url, maxTokenId };
      }));
      const catalog = candidates.find((entry) => entry.maxTokenId !== null);
      if (catalog) {
        cached = {
          maxTokenId: catalog.maxTokenId,
          source: catalog.url,
          checkedAt: new Date(now()).toISOString(),
          loadedAt: now()
        };
        return cached;
      }
    }
    throw new HttpError(502, 'sbt_catalog_not_found');
  }

  async function readText(url, signal) {
    try {
      const response = await fetchImpl(url, { signal, cache: 'no-store' });
      if (!response.ok) throw new Error('http_error');
      const body = await response.text();
      if (body.length > 8000000) throw new Error('response_too_large');
      return body;
    } catch {
      throw new HttpError(502, 'sbt_catalog_request_failed');
    }
  }
}

export function parseSbtCatalogMaximum(source) {
  const exported = source.match(/"SBT_BADGES",0,([\w$]+)/);
  if (!exported) {
    if (source.includes('"SBT_BADGES"')) throw new HttpError(502, 'sbt_catalog_format_changed');
    return null;
  }
  const variable = exported[1].replace(/\$/g, '\\$');
  const declaration = new RegExp(`(?:let |const |var |,)\\s*${variable}\\s*=\\s*\\[`).exec(source);
  if (!declaration) throw new HttpError(502, 'sbt_catalog_format_changed');
  const start = declaration.index + declaration[0].length;
  // Mask strings before matching brackets; badge descriptions may contain any
  // punctuation. All top-level entries must be literal objects with an ID.
  const masked = source.slice(start).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, '""');
  let depth = 0;
  let objectStart = -1;
  const ids = new Set();
  for (let index = 0; index < masked.length; index++) {
    const char = masked[index];
    if (depth === 0) {
      if (char === ']') {
        if (!ids.size) break;
        return Math.max(...ids);
      }
      if (char === '{') objectStart = index;
      else if (!/[\s,]/.test(char)) break;
    }
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) {
        const object = masked.slice(objectStart, index + 1);
        const idMatch = object.match(/^\{\s*id\s*:\s*(\d+)\s*,/);
        const id = idMatch ? Number(idMatch[1]) : NaN;
        if (!Number.isSafeInteger(id) || id < 0 || id > MAX_TOKEN_ID || ids.has(id)) break;
        ids.add(id);
      }
    }
  }
  throw new HttpError(502, 'sbt_catalog_format_changed');
}

export const readSbtCatalog = createSbtCatalogReader();
