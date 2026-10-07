import { HttpError } from '../../http.mjs';
import { readRetrySeconds } from './request.mjs';

const REGISTRATION_URL = 'https://api.asksurf.ai/muninn/v1/partner/users/registration-check';

export function normalizeSurfEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpError(400, 'surf_email_invalid');
  return email;
}

// This endpoint proves active registration, not ownership of an arbitrary email.
// Ownership must be established by the caller before requesting a mission check.
export async function verifySurfRegistration({ email, partnerKey, fetchImpl = fetch, now = Date.now }) {
  const normalizedEmail = normalizeSurfEmail(email);
  let response;
  try {
    response = await fetchImpl(REGISTRATION_URL, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: { 'X-Partner-Key': partnerKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: normalizedEmail }),
    });
  } catch { return { outcome: 'unavailable', reason: 'surf_provider_unreachable' }; }
  // A key failure is a server configuration issue, never a participant failure.
  if (response.status === 401) return { outcome: 'unavailable', reason: 'surf_partner_key_rejected' };
  if (response.status === 429) {
    const retryAfterSeconds = readRetrySeconds(response.headers.get('retry-after'), now());
    return { outcome: 'unavailable', reason: 'surf_rate_limited',
      ...(retryAfterSeconds === null ? {} : { retryAfterSeconds }) };
  }
  if (response.status === 400) return { outcome: 'unavailable', reason: 'surf_email_rejected' };
  if (response.status !== 200) return { outcome: 'unavailable', reason: 'surf_provider_error' };
  let body;
  try { body = await response.json(); }
  catch { return { outcome: 'unavailable', reason: 'surf_response_invalid' }; }
  if (!body || Array.isArray(body) || typeof body.registered !== 'boolean' || body.success === false)
    return { outcome: 'unavailable', reason: 'surf_response_invalid' };
  return body.registered ? { outcome: 'verified' } : { outcome: 'incomplete', reason: 'surf_not_registered' };
}
