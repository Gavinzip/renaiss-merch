import { createHmac } from 'node:crypto';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 120;
const MAX_SIGNED_URL_TTL_SECONDS = 300;
const SIGNATURE_VERSION = 'v1';

export function createPrivateMediaSignedUrl(source, now = Date.now()) {
  const url = new URL(source.remoteUrl);
  const ttlSeconds = readSignedUrlTtlSeconds(
    process.env.PRIVATE_MEDIA_SIGNED_URL_TTL_SECONDS
  );
  const expires = Math.floor(now / 1000) + ttlSeconds;
  const payload = createSignaturePayload(url.pathname, expires);
  const signature = createHmac('sha256', source.signingSecret)
    .update(payload)
    .digest('base64url');

  url.searchParams.set('expires', String(expires));
  url.searchParams.set('signature', signature);
  return url.toString();
}

function createSignaturePayload(pathname, expires) {
  return `${SIGNATURE_VERSION}\n${pathname}\n${expires}`;
}

function readSignedUrlTtlSeconds(value) {
  if (value === undefined || String(value).trim() === '') {
    return DEFAULT_SIGNED_URL_TTL_SECONDS;
  }

  const ttlSeconds = Number.parseInt(String(value), 10);

  if (
    !Number.isSafeInteger(ttlSeconds) ||
    ttlSeconds < 30 ||
    ttlSeconds > MAX_SIGNED_URL_TTL_SECONDS
  ) {
    throw new Error(
      'PRIVATE_MEDIA_SIGNED_URL_TTL_SECONDS must be between 30 and 300.'
    );
  }

  return ttlSeconds;
}
