import { sha256 } from 'ethers';
import type { LoadedProof, ProofOverview, ProofStage } from '../../../shared/public-proof/types';
const hashPattern = /^0x[0-9a-f]{64}$/i;
export function proofLocation(search: string) {
  const query = new URLSearchParams(search);
  for (const key of query.keys()) if (query.getAll(key).length !== 1) throw new Error('驗證連結包含重複的查詢參數。');
  for (const key of query.keys()) if (!['event','stage','tx','bundleHash','lang'].includes(key)) {
    throw new Error('驗證連結包含不支援的查詢參數。');
  }
  const event = query.get('event') ?? 'worlds-2026';
  const stage = query.get('stage') ?? 'final';
  const tx = query.get('tx') ?? '';
  const bundleHash = query.get('bundleHash') ?? '';
  if (event !== 'worlds-2026' || !['quarter', 'semi', 'final'].includes(stage) ||
    (tx && !hashPattern.test(tx)) ||
    (bundleHash && !hashPattern.test(bundleHash))) throw new Error('驗證連結的活動、階段或紀錄識別碼無效。');
  return { event, stage: stage as ProofStage, tx, bundleHash };
}
export async function readProofOverview(signal: AbortSignal): Promise<ProofOverview> {
  const response = await fetch('/api/public-proofs/worlds-2026/rounds', { cache: 'no-store', signal });
  if (!response.ok) throw new Error(response.status === 503 ? '尚未設定本活動的公開 proof 資料來源。' : '無法讀取活動公開紀錄，請稍後重試。');
  const data = await response.json() as ProofOverview;
  if (data.event !== 'worlds-2026' || !Array.isArray(data.rounds) || !data.authority || !Array.isArray(data.authorities) || data.rounds.length !== 3) throw new Error('公開紀錄格式不正確。');
  return data;
}
export async function readRoundProof(overview: ProofOverview, stage: ProofStage, expectedHash: string, tx: string, signal: AbortSignal, allowMissing = false): Promise<LoadedProof | null> {
  const round = overview.rounds.find(r => r.stage === stage);
  if (!round) throw new Error('找不到指定賽事階段。');
  const pinned = !!(expectedHash || tx);
  if (!pinned && round.status !== 'published') return null;
  const query = new URLSearchParams();
  if (expectedHash || (!pinned && round.bundleHash)) query.set('bundleHash', expectedHash || round.bundleHash!);
  if (tx) query.set('tx', tx);
  const response = await fetch(`/api/public-proofs/worlds-2026/${stage}/bundle?${query}`, { cache: 'no-store', signal });
  if (response.status === 409 && allowMissing) return null;
  if (!response.ok) throw new Error('無法下載已公布的 proof，請稍後重試。');
  const bytes = new Uint8Array(await response.arrayBuffer());
  const hash = sha256(bytes);
  if (hash !== response.headers.get('x-proof-sha256') || (!pinned && hash !== round.bundleHash) ||
    (expectedHash && hash.toLowerCase() !== expectedHash.toLowerCase())) throw new Error('Proof 檔案與指定紀錄的雜湊不一致。');
  const bundle = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as LoadedProof['bundle'];
  if (!bundle.chain || !hashPattern.test(bundle.chain.requestTx) || !hashPattern.test(bundle.chain.commitmentTx)) throw new Error('Proof 缺少有效的公開交易紀錄。');
  if (bundle.protocol !== 'renaiss-worlds-ticket-ecvrf-v1' || bundle.manifest?.campaignId !== 'worlds-2026' ||
    bundle.manifest.stage !== stage || (!pinned && bundle.manifest.roundId !== round.roundId) ||
    (tx && bundle.chain.requestTx.toLowerCase() !== tx.toLowerCase())) throw new Error('Proof 屬於其他活動、階段或交易。');
  if (!bundle.commitment || !Array.isArray(bundle.manifest.matches) || !bundle.manifest.matches.length ||
    bundle.manifest.matches.some(m => !m || typeof m.matchId !== 'string' || typeof m.prize?.name !== 'string') ||
    !Array.isArray(bundle.result?.picks) || !bundle.result.picks.length || typeof bundle.proof !== 'string' ||
    bundle.result.picks.some(p => !Number.isSafeInteger(p.rank) || p.rank < 0 || p.rank > 2 ||
      !Number.isSafeInteger(p.ticketNumber) || !Array.isArray(p.path) || typeof p.participantId !== 'string' ||
      typeof p.matchId !== 'string' || !Number.isSafeInteger(p.position) ||
      !bundle.manifest.matches.some(m => m.matchId === p.matchId))) {
    throw new Error('Proof 結構不完整，尚未開始瀏覽器驗證。');
  }
  const authority = overview.authorities.find(a => a.configured &&
    a.chainId === bundle.chain.chainId && a.contract?.toLowerCase() === bundle.chain.contract?.toLowerCase() &&
    a.runtimeHash.toLowerCase() === bundle.chain.runtimeHash?.toLowerCase());
  if (!authority) throw new Error('此 proof 的鏈、合約或程式版本尚未獨立核准，不能開始驗證。');
  return { bundle, bundleHash: hash, authority };
}

// A submitted hash searches all event stages. An explicitly pinned URL retains
// its stage constraint; neither lookup may substitute the latest publication.
export async function readProofByIdentity(overview: ProofOverview, expectedHash: string, tx: string, signal: AbortSignal, stage?: ProofStage): Promise<LoadedProof> {
  const candidates = stage ? [stage] : (['quarter', 'semi', 'final'] as const);
  const found = (await Promise.all(candidates.map(s => readRoundProof(overview, s, expectedHash, tx, signal, true))))
    .filter((proof): proof is LoadedProof => proof !== null);
  if (found.length !== 1) throw new Error(found.length ? '此識別碼對應多份紀錄，無法唯一確認。' : '找不到符合此 hash 的已公布 proof。');
  return found[0];
}
