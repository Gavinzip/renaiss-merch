const ALLOWED_METHODS = new Set(['GET', 'HEAD']);
const PRIVATE_MEDIA_PREFIX = 'merch/v1.2/';

export default {
  async fetch(request, env) {
    if (!ALLOWED_METHODS.has(request.method)) {
      return new Response('Method not allowed.', {
        headers: { Allow: 'GET, HEAD' },
        status: 405
      });
    }

    if (
      !env.MEDIA_PROXY_TOKEN ||
      !(await hasValidToken(request, env.MEDIA_PROXY_TOKEN))
    ) {
      return new Response('Unauthorized.', {
        headers: { 'Cache-Control': 'private, no-store' },
        status: 401
      });
    }

    const objectKey = readObjectKey(new URL(request.url));

    if (!objectKey) {
      return new Response('Not found.', {
        headers: { 'Cache-Control': 'private, no-store' },
        status: 404
      });
    }

    if (request.method === 'HEAD') {
      const object = await env.PRIVATE_MEDIA.head(objectKey);

      if (!object) {
        return notFound();
      }

      return new Response(null, {
        headers: createObjectHeaders(object),
        status: 200
      });
    }

    const rangeHeader = request.headers.get('Range');
    const object = await env.PRIVATE_MEDIA.get(objectKey, {
      range: rangeHeader ? request.headers : undefined
    });

    if (!object) {
      return notFound();
    }

    const headers = createObjectHeaders(object);
    let status = 200;

    if (rangeHeader && object.range) {
      const range = normalizeRange(object.range, object.size);

      headers.set(
        'Content-Range',
        `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`
      );
      headers.set('Content-Length', String(range.length));
      status = 206;
    }

    return new Response(object.body, { headers, status });
  }
};

async function hasValidToken(request, expectedToken) {
  const authorization = request.headers.get('Authorization') || '';
  const suppliedToken = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';
  const encoder = new TextEncoder();
  const [suppliedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(suppliedToken)),
    crypto.subtle.digest('SHA-256', encoder.encode(expectedToken))
  ]);
  const suppliedBytes = new Uint8Array(suppliedDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = 0;

  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= suppliedBytes[index] ^ expectedBytes[index];
  }

  return difference === 0 && suppliedToken.length === expectedToken.length;
}

function readObjectKey(url) {
  let pathname;

  try {
    pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  } catch {
    return null;
  }

  if (
    !pathname.startsWith(PRIVATE_MEDIA_PREFIX) ||
    pathname.includes('..') ||
    pathname.includes('\\')
  ) {
    return null;
  }

  return pathname;
}

function createObjectHeaders(object) {
  const headers = new Headers();

  object.writeHttpMetadata(headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Content-Length', String(object.size));
  headers.set('ETag', object.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  return headers;
}

function normalizeRange(range, objectSize) {
  if ('offset' in range) {
    return {
      length: range.length ?? objectSize - range.offset,
      offset: range.offset
    };
  }

  return {
    length: range.suffix,
    offset: Math.max(0, objectSize - range.suffix)
  };
}

function notFound() {
  return new Response('Not found.', {
    headers: { 'Cache-Control': 'private, no-store' },
    status: 404
  });
}
