import { HttpError } from './http.mjs';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeClaimEmail(value) {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'email_invalid');
  }

  const email = value.trim().toLowerCase();

  if (!email || email.length > 160 || !emailPattern.test(email)) {
    throw new HttpError(400, 'email_invalid');
  }

  return email;
}
