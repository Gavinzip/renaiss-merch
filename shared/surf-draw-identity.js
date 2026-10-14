/** A display name is never substituted with an email address or a wallet. */
export function surfWinnerDisplayName(value) {
  if (typeof value !== 'string') return '';
  const name = value.replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim().replace(/\s+/g, ' ');
  if (!name || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(name) || /0x[a-fA-F0-9]{40}/.test(name)) return '';
  return name;
}
