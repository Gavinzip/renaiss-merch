import { readFileSync } from 'node:fs';
import { HttpError } from '../http.mjs';

// Explicit server-only sources. Never expose this key in a VITE_* variable.
export function surfAccountConfig() {
  const inline = process.env.SURF_PARTNER_KEY?.trim();
  const file = process.env.SURF_PARTNER_KEY_FILE?.trim();
  if (inline && file) throw new HttpError(503, 'surf_key_configuration_conflict');
  let partnerKey = inline;
  if (file) {
    try { partnerKey = readFileSync(file, 'utf8').trim(); }
    catch { throw new HttpError(503, 'surf_key_file_unavailable'); }
  }
  if (!partnerKey) throw new HttpError(503, 'surf_not_configured');
  if (/\s/.test(partnerKey)) throw new HttpError(503, 'surf_key_invalid');
  return { partnerKey };
}
