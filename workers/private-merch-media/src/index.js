const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEFAULT_SIGNED_URL_MAX_TTL_SECONDS = 300;
const PRIVATE_MEDIA_PREFIX = 'merch/v1.2/';
const SIGNATURE_VERSION = 'v1';

export default {
  async fetch(request, env) {
    const corsHeaders = createCorsHeaders(request, env);

    if (request.headers.has('Origin') && !corsHeaders) {
      return privateResponse('Origin not allowed.', 403);
    }

    if (request.method === 'OPTIONS') {
      return createPreflightResponse(corsHeaders);
    }

    if (!ALLOWED_METHODS.has(request.method)) {
      return privateResponse('Method not allowed.', 405, corsHeaders, {
        Allow: 'GET, HEAD, OPTIONS'
      });
    }

    const url = new URL(request.url);
    const isAuthorized =
      Boolean(env.MEDIA_PROXY_TOKEN) &&
      ((await hasValidToken(request, env.MEDIA_PROXY_TOKEN)) ||
        (await hasValidSignedUrl(url, env.MEDIA_PROXY_TOKEN, env)));

    if (!isAuthorized) {
      return privateResponse('Unauthorized.', 401, corsHeaders);
    }

    const objectKey = readObjectKey(url);

    if (!objectKey) {
      return privateResponse('Not found.', 404, corsHeaders);
    }

    if (request.method === 'HEAD') {
      const object = await env.PRIVATE_MEDIA.head(objectKey);

      if (!object) {
        return privateResponse('Not found.', 404, corsHeaders);
      }

      return new Response(null, {
        headers: createObjectHeaders(object, corsHeaders),
        status: 200
      });
    }

    const rangeHeader = request.headers.get('Range');
    const object = await env.PRIVATE_MEDIA.get(objectKey, {
      range: rangeHeader ? request.headers : undefined
    });

    if (!object) {
      return privateResponse('Not found.', 404, corsHeaders);
    }

    const headers = createObjectHeaders(object, corsHeaders);
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

async function hasValidSignedUrl(url, signingSecret, env) {
  const expiresValue = url.searchParams.get('expires') || '';
  const signatureValue = url.searchParams.get('signature') || '';

  if (
    !/^\d+$/.test(expiresValue) ||
    !/^[A-Za-z0-9_-]{43}$/.test(signatureValue)
  ) {
    return false;
  }

  const expires = Number.parseInt(expiresValue, 10);
  const now = Math.floor(Date.now() / 1000);
  const maxTtlSeconds = readSignedUrlMaxTtlSeconds(
    env.SIGNED_URL_MAX_TTL_SECONDS
  );

  if (
    !Number.isSafeInteger(expires) ||
    expires < now ||
    expires > now + maxTtlSeconds
  ) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    {
      hash: 'SHA-256',
      name: 'HMAC'
    },
    false,
    ['verify']
  );

  return crypto.subtle.verify(
    'HMAC',
    key,
    decodeBase64Url(signatureValue),
    encoder.encode(createSignaturePayload(url.pathname, expires))
  );
}

function createSignaturePayload(pathname, expires) {
  return `${SIGNATURE_VERSION}\n${pathname}\n${expires}`;
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function readSignedUrlMaxTtlSeconds(value) {
  if (value === undefined || String(value).trim() === '') {
    return DEFAULT_SIGNED_URL_MAX_TTL_SECONDS;
  }

  const ttlSeconds = Number.parseInt(String(value), 10);

  if (
    !Number.isSafeInteger(ttlSeconds) ||
    ttlSeconds < 30 ||
    ttlSeconds > 900
  ) {
    throw new Error('SIGNED_URL_MAX_TTL_SECONDS must be between 30 and 900.');
  }

  return ttlSeconds;
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

function createObjectHeaders(object, corsHeaders) {
  const headers = new Headers(corsHeaders || undefined);

  object.writeHttpMetadata(headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Content-Length', String(object.size));
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
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

function createCorsHeaders(request, env) {
  const origin = request.headers.get('Origin');

  if (!origin) {
    return null;
  }

  const allowedOrigins = new Set(
    String(env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );

  if (!allowedOrigins.has(origin)) {
    return null;
  }

  return {
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Expose-Headers':
      'Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag',
    'Access-Control-Max-Age': '86400',
    'Timing-Allow-Origin': origin,
    Vary: 'Origin'
  };
}

function createPreflightResponse(corsHeaders) {
  if (!corsHeaders) {
    return privateResponse('Origin required.', 403);
  }

  return new Response(null, {
    headers: {
      ...corsHeaders,
      'Cache-Control': 'public, max-age=86400'
    },
    status: 204
  });
}

function privateResponse(body, status, corsHeaders, extraHeaders = {}) {
  return new Response(body, {
    headers: {
      ...corsHeaders,
      'Cache-Control': 'private, no-store',
      ...extraHeaders
    },
    status
  });
}
