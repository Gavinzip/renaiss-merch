import { readSbtCatalog } from './sbt-catalog.mjs';
import { readExplorerSbtBalances } from './sbt-explorer.mjs';
import { readOnchainSbtBalances } from './sbt-onchain.mjs';
import { selectMaximumSbtResult } from './sbt-verification.mjs';

const cache = new Map();
const pending = new Map();

export async function readDualSourceSbtBalance(wallet, config, options = {}) {
  const key = `${config.chainId}:${config.sbtContract}:${wallet}:${config.apiUrl}:${config.rpcUrl}`;
  const injected = options.readExplorerBalances || options.readOnchainBalances || options.readCatalog;
  const cached = cache.get(key);
  if (!injected && !options.forceRefresh && cached && Date.now() - cached.at < config.sbtCacheTtlMs) {
    return structuredClone(cached.result);
  }
  if (!injected && pending.has(key)) return structuredClone(await pending.get(key));
  const request = load();
  if (!injected) pending.set(key, request);
  try {
    const result = await request;
    if (!injected) {
      if (cache.size >= 1000) cache.delete(cache.keys().next().value);
      cache.set(key, { result, at: Date.now() });
    }
    return structuredClone(result);
  } finally {
    if (!injected) pending.delete(key);
  }

  async function load() {
    // Both sources must succeed. A failed source is not a zero balance and must
    // not silently become a single-source eligibility decision.
    const explorerPromise = (options.readExplorerBalances || readExplorerSbtBalances)(wallet, config);
    const chainPromise = (async () => {
      const catalog = await (options.readCatalog || readSbtCatalog)();
      return (options.readOnchainBalances || readOnchainSbtBalances)(wallet, config, catalog);
    })();
    const [explorer, onchain] = await Promise.all([explorerPromise, chainPromise]);
    return selectMaximumSbtResult(explorer, onchain);
  }
}
