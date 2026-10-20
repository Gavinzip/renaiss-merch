import { HttpError } from './http.mjs';

// One release instant for both products, interpreted by the server in UTC.
export const SURF_STORE_OPENS_AT = '2026-10-21T19:00:00+08:00';
const opensAtMs = Date.parse(SURF_STORE_OPENS_AT);

export function getSurfStoreRelease(now = Date.now()) {
  if (!Number.isSafeInteger(now)) throw new Error('surf_store_clock_invalid');
  return {
    opensAt: SURF_STORE_OPENS_AT,
    serverNow: new Date(now).toISOString(),
    open: now >= opensAtMs,
  };
}

export function assertSurfStoreOpen(now = Date.now()) {
  if (!getSurfStoreRelease(now).open) throw new HttpError(403, 'surf_store_not_open');
}
