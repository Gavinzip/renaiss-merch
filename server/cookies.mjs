export const OAUTH_CHALLENGE_COOKIE = 'renaiss_oauth_challenge';
export const SESSION_COOKIE = 'renaiss_merch_session';

export function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = new Map();

  if (!header) {
    return cookies;
  }

  for (const part of header.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');

    if (!name) {
      continue;
    }

    const value = valueParts.join('=');
    cookies.set(name, decodeURIComponent(value));
  }

  return cookies;
}

export function isHttpsRequest(req) {
  const forwardedProto = firstHeaderValue(req.headers['x-forwarded-proto']);

  return forwardedProto === 'https' || req.socket.encrypted === true;
}

export function setCookie(req, res, name, value, options = {}) {
  appendSetCookie(
    res,
    serializeCookie(name, value, {
      httpOnly: true,
      path: '/',
      sameSite: 'Lax',
      secure: isHttpsRequest(req),
      ...options
    })
  );
}

export function clearCookie(req, res, name) {
  setCookie(req, res, name, '', {
    maxAge: 0
  });
}

function serializeCookie(name, value, options) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.maxAge === 0) {
    segments.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  }

  if (options.path) {
    segments.push(`Path=${options.path}`);
  }

  if (options.httpOnly) {
    segments.push('HttpOnly');
  }

  if (options.secure) {
    segments.push('Secure');
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  return segments.join('; ');
}

function appendSetCookie(res, cookie) {
  const current = res.getHeader('Set-Cookie');

  if (!current) {
    res.setHeader('Set-Cookie', cookie);
    return;
  }

  if (Array.isArray(current)) {
    res.setHeader('Set-Cookie', [...current, cookie]);
    return;
  }

  res.setHeader('Set-Cookie', [current, cookie]);
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0]?.split(',')[0]?.trim();
  }

  return value?.split(',')[0]?.trim();
}
