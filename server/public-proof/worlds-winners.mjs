import { HttpError, sendJson } from '../http.mjs';
import { requireProofStage, worldsProofConfig } from './config.mjs';
import { hash32 } from './registry.mjs';
import { readProofIndex } from './source.mjs';

const matchIds = { quarter: /^qf-0[1-4]$/, semi: /^sf-0[12]$/, final: /^gf-01$/ };
const username = /^[a-z0-9_]{1,15}$/i;
const path = '/api/public-proofs/worlds-2026/winners';

function matchesProof(draw, stage, tx, bundleHash) {
  if (draw?.source !== 'ecvrf' || draw.rehearsal || !matchIds[stage].test(draw.matchId)) return false;
  let link;
  try { link = new URL(draw.proofUrl); } catch { return false; }
  const query = link.searchParams;
  return link.pathname === '/verify' &&
    query.get('event') === 'worlds-2026' && query.get('stage') === stage &&
    query.get('tx')?.toLowerCase() === tx && query.get('bundleHash')?.toLowerCase() === bundleHash;
}

export function createWorldsWinnerRoute({ environment, fetchPublic }) {
  return async (req, res, url) => {
    if (url.pathname !== path) return false;
    if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
    const query = url.searchParams;
    if ([...query.keys()].some(key => !['stage', 'tx', 'bundleHash'].includes(key) || query.getAll(key).length !== 1) ||
      !hash32(query.get('tx')) || !hash32(query.get('bundleHash'))) throw new HttpError(400, 'proof_query_invalid');
    const stage = requireProofStage(query.get('stage'));
    const tx = query.get('tx').toLowerCase(), bundleHash = query.get('bundleHash').toLowerCase();
    const { origin } = worldsProofConfig(environment);
    if (!origin) throw new HttpError(503, 'proof_source_not_configured');

    // Read the same anonymous publication as the Worlds winners page. Return
    // only its public X usernames, scoped to the exact transaction and bundle.
    const published = await readProofIndex(origin, '/api/bootstrap', fetchPublic);
    if (!Array.isArray(published.draws)) throw new HttpError(502, 'proof_source_invalid');
    const matches = new Set();
    const winners = [];
    for (const draw of published.draws) {
      if (!matchesProof(draw, stage, tx, bundleHash)) continue;
      if (!Array.isArray(draw.winners) || matches.has(draw.matchId)) throw new HttpError(502, 'proof_source_invalid');
      matches.add(draw.matchId);
      const winner = draw.winners.find(row => row?.position === 'winner' && row.rank === 0);
      if (Number.isSafeInteger(winner?.ticketNumber) && winner.ticketNumber > 0 &&
          typeof winner.xUsername === 'string' && username.test(winner.xUsername)) {
        winners.push({ matchId: draw.matchId, ticketNumber: winner.ticketNumber, xUsername: winner.xUsername });
      }
    }
    sendJson(res, 200, { winners });
    return true;
  };
}
