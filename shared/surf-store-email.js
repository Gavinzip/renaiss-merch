export const SURF_STORE_EMAIL_MAX_LENGTH = 254;

// Provider-independent dot-atom addresses with a complete, DNS-shaped domain.
// Kept in shared code so the form and submission API accept the same addresses.
export const SURF_STORE_EMAIL_PATTERN = "^[a-z0-9!#$%&'*+/=?^_`{|}~-]+([.][a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$";
const emailPattern = new RegExp(SURF_STORE_EMAIL_PATTERN);

export function normalizeSurfStoreEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > SURF_STORE_EMAIL_MAX_LENGTH || email.split('@')[0].length > 64 || !emailPattern.test(email)) return null;
  return email;
}
