import { sha256 } from 'ethers';
import { HttpError, sendJson } from '../http.mjs';
import { requireProofStage, worldsProofConfig } from './config.mjs';

const MAX_BYTES = 32 * 1024 * 1024;
async function readPublicResponse(response) {
  const reject = async (status, code) => { try { await response.body?.cancel(); } finally { throw new HttpError(status, code); } };
  if (!response.ok) return reject(response.status === 409 ? 409 : 502,
    response.status === 409 ? 'proof_not_published' : 'proof_source_unavailable');
  if (!response.body || !response.headers.get('content-type')?.includes('application/json')) return reject(502, 'proof_source_invalid');
  if (Number(response.headers.get('content-length')) > MAX_BYTES) return reject(502, 'proof_bundle_too_large');
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > MAX_BYTES) throw new HttpError(502, 'proof_bundle_too_large'); chunks.push(value); }
  } finally { await reader.cancel(); }
  const bytes = Buffer.concat(chunks);
  let json; try { json = JSON.parse(bytes.toString('utf8')); } catch { throw new HttpError(502, 'proof_source_invalid'); }
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new HttpError(502, 'proof_source_invalid');
  return { json, bytes };
}

// Only this operator-configured event origin is contacted. No cookies, tokens,
// query-supplied URLs, admin routes, redirects or upstream authority are forwarded.
export function createPublicProofRoutes({ environment = process.env, fetchPublic = fetch } = {}) {
  return async (req, res, url) => {
    if (!url.pathname.startsWith('/api/public-proofs/')) return false;
    if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
    const path = /^\/api\/public-proofs\/worlds-2026\/(rounds|(?:quarter|semi|final)\/(?:bundle|history))$/.exec(url.pathname);
    if (!path) throw new HttpError(404, 'proof_event_not_supported');
    for (const key of url.searchParams.keys()) if (!['download', 'bundleHash', 'tx', 'roundId'].includes(key) || url.searchParams.getAll(key).length !== 1) throw new HttpError(400, 'proof_query_invalid');
    const expectedHash = url.searchParams.get('bundleHash');
    for (const key of ['bundleHash', 'tx', 'roundId']) if (url.searchParams.has(key) && !/^0x[0-9a-f]{64}$/i.test(url.searchParams.get(key))) throw new HttpError(400, 'proof_query_invalid');
    if (url.searchParams.has('download') && url.searchParams.get('download') !== '1') throw new HttpError(400, 'proof_query_invalid');
    const { origin, authority, authorities } = worldsProofConfig(environment);
    if (!origin) throw new HttpError(503, 'proof_source_not_configured');
    const isOverview = path[1] === 'rounds';
    const isHistory = path[1].endsWith('/history');
    if ((isOverview || isHistory) && url.search) throw new HttpError(400, 'proof_query_invalid');
    const stage = isOverview ? null : requireProofStage(path[1].split('/')[0]);
    const remote = new URL(isOverview ? '/api/ecvrf/rounds' : `/api/ecvrf/rounds/${stage}/${isHistory ? 'history' : 'bundle'}`, origin);
    if (!isOverview && !isHistory) {
      remote.searchParams.set('download', '1');
      for (const key of ['bundleHash', 'tx', 'roundId']) if (url.searchParams.has(key)) remote.searchParams.set(key, url.searchParams.get(key));
    }
    let response;
    try { response = await fetchPublic(remote.href, { redirect: 'error',
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) }); }
    catch { throw new HttpError(502, 'proof_source_unavailable'); }
    let payload;
    try { payload = await readPublicResponse(response); }
    catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(502, 'proof_source_unavailable'); }
    const { json, bytes } = payload;
    if (isOverview) {
      if (!Array.isArray(json.rounds) || json.rounds.length !== 3 ||
        json.rounds.some(r => !r || typeof r !== 'object' || Array.isArray(r)) ||
        ['quarter', 'semi', 'final'].some(s => json.rounds.filter(r => r.stage === s).length !== 1)) throw new HttpError(502, 'proof_source_invalid');
      // The source registry is deliberately discarded. Authority comes from
      // separately approved Merch settings, never from the bundle or source API.
      sendJson(res, 200, { event: 'worlds-2026', authority, authorities, rounds: json.rounds.map(r => ({ stage: r.stage,
        name: r.name, roundId: r.roundId, status: r.status, bundleHash: r.bundleHash,
        publishedAt: r.publishedAt, proofUrl: r.proofUrl ? `/api/public-proofs/worlds-2026/${r.stage}/bundle` : null })) });
    } else if (isHistory) {
      if (json.stage !== stage || !Array.isArray(json.rounds) || json.rounds.length > 10000 || json.rounds.some(r =>
        !r || r.stage !== stage || !/^0x[0-9a-f]{64}$/i.test(r.roundId) ||
        (r.status === 'published' && (!/^0x[0-9a-f]{64}$/i.test(r.bundleHash) || !/^0x[0-9a-f]{64}$/i.test(r.requestTx))))) throw new HttpError(502, 'proof_history_invalid');
      sendJson(res, 200, { stage, rounds: json.rounds.map(r => ({ stage, roundId: r.roundId,
        status: r.status, bundleHash: r.bundleHash, requestTx: r.requestTx,
        proofUrl: r.status === 'published' ? `/api/public-proofs/worlds-2026/${stage}/bundle?${new URLSearchParams({ bundleHash: r.bundleHash, tx: r.requestTx })}` : null })) });
    } else {
      const hash = sha256(bytes);
      if (expectedHash && hash.toLowerCase() !== expectedHash.toLowerCase()) throw new HttpError(409, 'proof_record_changed');
      if ((url.searchParams.has('tx') && json.chain?.requestTx?.toLowerCase() !== url.searchParams.get('tx').toLowerCase()) ||
        (url.searchParams.has('roundId') && json.commitment?.roundId?.toLowerCase() !== url.searchParams.get('roundId').toLowerCase())) throw new HttpError(409, 'proof_record_changed');
      if (response.headers.get('x-proof-sha256') !== hash || json.protocol !== 'renaiss-worlds-ticket-ecvrf-v1' ||
        json.manifest?.campaignId !== 'worlds-2026' || json.manifest?.stage !== stage) throw new HttpError(502, 'proof_bundle_invalid');
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('X-Proof-SHA256', hash);
      if (url.searchParams.get('download') === '1') res.setHeader('Content-Disposition', `attachment; filename="worlds-ecvrf-${stage}.json"`);
      res.end(bytes);
    }
    return true;
  };
}
