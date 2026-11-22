import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import { HttpError } from '../http.mjs';

export function clientAddressHash(req, environment = process.env) {
  // Vercel overwrites X-Forwarded-For at its trusted edge. Outside Vercel,
  // ignore caller-controlled forwarding headers and use the actual peer.
  const forwarded = req.headers?.['x-forwarded-for'];
  const address = environment.VERCEL === '1'
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '')
    : req.socket?.remoteAddress;
  if (!address || !isIP(address)) throw new HttpError(503, 'client_address_unavailable');
  return createHash('sha256').update(address).digest('hex');
}
