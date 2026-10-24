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

// Export names change between official builds. Identify literal badge records
// by their fields and SBT media paths, without evaluating remote code.
export function parseSbtCatalogMaximum(source) {
  const objects = readSbtCatalogObjects(source);
  return objects ? Math.max(...objects.map(object => Number(object.masked.match(/^\{\s*id\s*:\s*(\d+)\s*,/)[1]))) : null;
}

function readSbtCatalogObjects(source) {
  if (!source.includes('/SBT/') || !source.includes('howToEarn:')) return null;
  const masked = source.replace(
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g,
    (value) => ' '.repeat(value.length)
  );
  const declarations = /(?:\b(?:let|const|var)\s+|,)\s*[\w$]+\s*=\s*\[/g;
  const matches = [];
  for (const declaration of masked.matchAll(declarations)) {
    const start = declaration.index + declaration[0].length;
    if (!/^\s*\{\s*id\s*:\s*\d+\s*,/.test(masked.slice(start))) continue;
    let depth = 0;
    let objectStart = -1;
    let end = -1;
    const objects = [];
    for (let index = start; index < masked.length; index++) {
      const char = masked[index];
      if (depth === 0) {
        if (char === ']') { end = index; break; }
        if (char === '{') objectStart = index;
        else if (!/[\s,]/.test(char)) break;
      }
      if (char === '{') depth++;
      if (char === '}') {
        depth--;
        if (depth === 0) objects.push({
          masked: masked.slice(objectStart, index + 1),
          source: source.slice(objectStart, index + 1),
        });
      }
    }
    const isBadge = (object) => ['name', 'description', 'howToEarn', 'imageUrl']
      .every((field) => new RegExp(`\\b${field}\\s*:`).test(object.masked)) &&
      /\bimageUrl\s*:\s*"https:\/\/[^"\s]+\/SBT\/[^"\s]+"/.test(object.source);
    if (!objects.length || !isBadge(objects[0])) continue;
    if (end < 0 || !objects.every(isBadge)) {
      throw new HttpError(502, 'sbt_catalog_format_changed');
    }
    const ids = new Set();
    for (const object of objects) {
      const match = object.masked.match(/^\{\s*id\s*:\s*(\d+)\s*,/);
      const id = match ? Number(match[1]) : NaN;
      if (!Number.isSafeInteger(id) || id < 0 || id > MAX_TOKEN_ID || ids.has(id)) {
        throw new HttpError(502, 'sbt_catalog_format_changed');
      }
      ids.add(id);
    }
    matches.push(objects);
  }
  if (matches.length > 1) throw new HttpError(502, 'sbt_catalog_format_changed');
  return matches.length === 1 ? matches[0] : null;
}

export const readSbtCatalog = createSbtCatalogReader();

export function parseSbtCatalogRecords(source) {
  const objects = readSbtCatalogObjects(source);
  if (!objects) return null;
  return objects.map(object => {
      const id = Number(object.masked.match(/^\{\s*id\s*:\s*(\d+)\s*,/)[1]);
      const record = { id };
      for (const field of ['name', 'description', 'howToEarn', 'imageUrl']) {
        const literal = object.source.match(new RegExp('\\b' + field + '\\s*:\\s*("(?:\\\\.|[^"\\\\])*")'));
        if (!literal) throw new HttpError(502, 'sbt_catalog_format_changed');
        try { record[field] = JSON.parse(literal[1]); }
        catch { throw new HttpError(502, 'sbt_catalog_format_changed'); }
      }
      const image = new URL(record.imageUrl);
      if (!record.name || record.name.length > 300 || image.protocol !== 'https:' ||
          image.username || image.password || !image.pathname.startsWith('/SBT/')) {
        throw new HttpError(502, 'sbt_catalog_format_changed');
      }
      return record;
  });
}

// Metadata is a separate reader: a metadata format change must not alter the
// existing badge-count verification policy used for Merch eligibility.
const badgeCatalogs = new Map();
export async function readSbtBadgeCatalog() {
  const catalog = await readSbtCatalog();
  if (!badgeCatalogs.has(catalog.source)) {
    const request = (async () => {
      const response = await fetch(catalog.source, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new HttpError(502, 'sbt_catalog_request_failed');
      const source = await response.text();
      if (source.length > 8000000) throw new HttpError(502, 'sbt_catalog_format_changed');
      const badges = parseSbtCatalogRecords(source);
      if (!badges) throw new HttpError(502, 'sbt_catalog_not_found');
      return { ...catalog, badges };
    })();
    badgeCatalogs.set(catalog.source, request);
    void request.catch(() => badgeCatalogs.delete(catalog.source));
    if (badgeCatalogs.size > 3) badgeCatalogs.delete(badgeCatalogs.keys().next().value);
  }
  return badgeCatalogs.get(catalog.source);
}
