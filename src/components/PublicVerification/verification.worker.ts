import { FetchRequest, JsonRpcProvider } from 'ethers';
import { collectChainFacts } from '../../../shared/public-proof/worlds/chain.mjs';
import { createWorldsVerification } from '../../../shared/public-proof/worlds/steps.mjs';
import type { LoadedProof } from '../../../shared/public-proof/types';

let verification: ReturnType<typeof createWorldsVerification> | null = null;
let running = false;
self.onmessage = async (event: MessageEvent<{ type: 'init'; data: LoadedProof } | { type: 'step'; step: number }>) => {
  if (event.data.type === 'init') {
    const { bundle, bundleHash, authority } = event.data.data;
    verification = createWorldsVerification({ bundle, expectedBundleHash: bundleHash, authority,
      readChain: async (registry, commitment, claimed) => {
        if (!registry.publicRpc) throw new Error('本活動尚未核准公開 RPC。');
        const request = new FetchRequest(registry.publicRpc); request.timeout = 15_000;
        const provider = new JsonRpcProvider(request, undefined, { batchMaxCount: 1 });
        try { return await collectChainFacts(provider, registry, commitment, claimed); }
        finally { provider.destroy(); }
      } });
    return;
  }
  if (!verification || running) return;
  running = true;
  try { self.postMessage({ type: 'checked', check: await verification.run(event.data.step) }); }
  catch (error) {
    // Transport/provider exceptions may contain a full RPC URL or response.
    self.postMessage({ type: 'failed', error: error instanceof Error && error.name === 'EcvRfVerificationError'
      ? error.message : '無法取得可驗證的鏈上資料。請確認公開 RPC、網路與合約設定後重試。' });
  } finally { running = false; }
};
