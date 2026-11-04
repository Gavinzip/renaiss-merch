import { HttpError, sendJson } from '../http.mjs';
import { createWorldsProofAdapter } from './worlds-adapter.mjs';

export const hash32 = value => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value);
const eventId = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;

// Each event supplies a reviewed adapter. Lookup is separate from independent
// proof verification: a matching transaction is never itself a successful check.
export function createProofRegistry(adapters) {
  if (adapters.length > 32 || new Set(adapters.map(a => a.event.id)).size !== adapters.length ||
      adapters.some(a => !eventId(a.event.id) || typeof a.resolve !== 'function')) throw new Error('Invalid public proof registry.');
  return { async resolve(selector) {
    const selected = selector.event ? adapters.filter(a => a.event.id === selector.event) : adapters;
    if (!selected.length) throw new HttpError(404, 'proof_event_not_supported');
    const outcomes = await Promise.allSettled(selected.map(async adapter => {
      const record = await adapter.resolve(selector);
      return record ? { event: adapter.event, record } : null;
    }));
    // Do not silently skip an unavailable event and declare a unique match.
    const failure = outcomes.find(r => r.status === 'rejected');
    if (failure) throw failure.reason;
    const matches = outcomes.map(r => r.value).filter(Boolean);
    if (matches.length !== 1) throw new HttpError(matches.length ? 409 : 404,
      matches.length ? 'proof_identity_ambiguous' : 'proof_not_found');
    return matches[0];
  } };
}

export function createProofLookupRoutes({ environment = process.env, fetchPublic = fetch, readTransaction, adapters } = {}) {
  return async (req, res, url) => {
    if (url.pathname !== '/api/public-proofs/resolve') return false;
    if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
    const query = url.searchParams;
    for (const key of query.keys()) if (!['tx','bundleHash','event','stage'].includes(key) || query.getAll(key).length !== 1) throw new HttpError(400,'proof_query_invalid');
    for (const key of ['tx','bundleHash']) if (query.has(key) && !hash32(query.get(key))) throw new HttpError(400,'proof_query_invalid');
    if ((!query.has('tx') && !query.has('bundleHash')) || (query.has('event') && !eventId(query.get('event'))) ||
        (query.has('stage') && !/^[a-z0-9-]{1,64}$/.test(query.get('stage')))) throw new HttpError(400,'proof_query_invalid');
    const registry = createProofRegistry(adapters ?? [createWorldsProofAdapter({ environment, fetchPublic, readTransaction })]);
    const result = await registry.resolve(Object.fromEntries(query));
    sendJson(res, 200, result);
    return true;
  };
}
