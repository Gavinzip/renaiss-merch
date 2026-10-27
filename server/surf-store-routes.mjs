import { HttpError, sendJson } from './http.mjs';
import { readJsonBody } from './shipping-details.mjs';
import { readSession, sameOrigin } from './postgres/auth.mjs';
import { surfStoreClaims } from './postgres/surf-store.mjs';
import { requireFulfillmentAdministrator } from './fulfillment-admin.mjs';

// Dependencies are injectable for isolated tests, never selectable by requests.
export function createSurfStoreRoutes({ claims = () => surfStoreClaims(), sessionReader = readSession,
  checkOrigin = sameOrigin, requireAdmin = requireFulfillmentAdministrator } = {}) {
  return async (req, res, url) => {
    if (url.pathname === '/api/surf-store/inventory') {
      if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
      // Only aggregate quantities are public; account and Gmail records stay private.
      sendJson(res, 200, await claims().inventorySnapshot());
      return true;
    }
    if (url.pathname === '/api/admin/surf-store/claims') {
      if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
      requireAdmin(await sessionReader(req));
      sendJson(res, 200, await claims().list());
      return true;
    }
    if (url.pathname !== '/api/surf-store/claim') return false;
    if (!['GET', 'POST'].includes(req.method)) throw new HttpError(405, 'method_not_allowed');
    const session = await sessionReader(req);
    if (req.method === 'GET') sendJson(res, 200, await claims().read(session, url.searchParams.get('rewardId')));
    else {
      checkOrigin(req);
      const input = await readJsonBody(req);
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'invalid_payload');
      sendJson(res, 200, { claim: await claims().submit(session, input) });
    }
    return true;
  };
}
