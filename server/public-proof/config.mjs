import { isAddress, ZeroAddress } from 'ethers';
import { RUNTIME_HASH, supportedRuntime } from '../../shared/public-proof/worlds/chain.mjs';
import { HttpError } from '../http.mjs';

export const stages = Object.freeze(['quarter', 'semi', 'final']);
export function worldsProofConfig(environment = process.env) {
  const raw = environment.MERCH_WORLDS_PROOF_ORIGIN?.trim();
  let origin = null;
  if (raw) {
    const url = new URL(raw);
    const local = environment.MERCH_PROOF_ALLOW_LOCAL_SOURCE === 'true' && environment.VERCEL !== '1' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Invalid fixed Worlds proof origin.');
    }
    origin = url.origin;
  }
  const chainId = Number(environment.MERCH_WORLDS_PROOF_CHAIN_ID);
  const contract = environment.MERCH_WORLDS_PROOF_CONTRACT?.trim() || null;
  const publicRpc = environment.MERCH_WORLDS_PROOF_PUBLIC_RPC?.trim() || null;
  const runtimeHash = environment.MERCH_WORLDS_PROOF_RUNTIME_HASH?.trim() || RUNTIME_HASH;
  if (!supportedRuntime(runtimeHash)) throw new Error('Unreviewed Worlds proof runtime.');
  const rpc = publicRpc ? new URL(publicRpc) : null;
  if (rpc && (rpc.protocol !== 'https:' || rpc.username || rpc.password || rpc.search || rpc.hash)) {
    throw new Error('Public proof RPC must be an HTTPS URL without credentials or query secrets.');
  }
  const configured = [56, 97].includes(chainId) && !!contract && isAddress(contract) && contract !== ZeroAddress && !!publicRpc;
  const authority = { configured, chainId: [56, 97].includes(chainId) ? chainId : null,
    contract, runtimeHash, publicRpc, context: 'event',
    reason: configured ? null : '尚未獨立設定並核准本活動的 chain、contract 與公開 RPC。' };
  const historical = JSON.parse(environment.MERCH_WORLDS_PROOF_HISTORICAL_AUTHORITIES || '[]');
  if (!Array.isArray(historical) || historical.length > 16) throw new Error('Invalid approved historical authorities.');
  const authorities = configured ? [authority] : [];
  for (const item of historical) {
    const rpc = new URL(item.publicRpc);
    if (![56, 97].includes(item.chainId) || !isAddress(item.contract) || item.contract.toLowerCase() === ZeroAddress ||
      !supportedRuntime(item.runtimeHash) || rpc.protocol !== 'https:' || rpc.username || rpc.password || rpc.search || rpc.hash ||
      !['event', 'rehearsal'].includes(item.context)) throw new Error('Invalid approved historical authority.');
    if (authorities.some(a => a.chainId === item.chainId && a.contract.toLowerCase() === item.contract.toLowerCase())) throw new Error('Duplicate approved contract authority.');
    authorities.push({ configured: true, chainId: item.chainId, contract: item.contract, runtimeHash: item.runtimeHash,
      publicRpc: rpc.href, context: item.context, reason: null });
  }
  return { origin, authority, authorities };
}
export function requireProofStage(stage) {
  if (!stages.includes(stage)) throw new HttpError(400, 'proof_stage_invalid');
  return stage;
}
