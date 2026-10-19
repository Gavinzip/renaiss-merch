import { getPublicOrigin } from '../config.mjs';
import { HttpError } from '../http.mjs';
export function assertLocalSurfOperatorRequest(req) {
  if (process.env.NODE_ENV === 'production') throw new HttpError(404, 'not_found');
  const host = String(req.headers.host || '');
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) throw new HttpError(403, 'local_reset_requires_loopback');
  if (req.method !== 'GET' && (req.headers.origin !== `http://${host}` || req.headers.origin !== getPublicOrigin(req))) throw new HttpError(403, 'invalid_request_origin');
}
