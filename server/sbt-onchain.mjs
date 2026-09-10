import { HttpError } from './http.mjs';

const BATCH_SIZE = 512;
const word = (value) => BigInt(value).toString(16).padStart(64, '0');

export async function readOnchainSbtBalances(wallet, config, catalog, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const maxTokenId = catalog.maxTokenId;
  if (!/^0x[\da-f]{40}$/i.test(wallet) || !/^0x[\da-f]{40}$/i.test(config.sbtContract) ||
      !Number.isSafeInteger(maxTokenId) || maxTokenId < 0 || maxTokenId > 10000) {
    throw new HttpError(500, 'sbt_onchain_input_invalid');
  }
  const signal = AbortSignal.timeout(15000);
  let requestId = 0;
  const [chainId, block] = await Promise.all([
    rpc('eth_chainId', []), rpc('eth_blockNumber', [])
  ]);
  if (quantity(chainId) !== BigInt(config.chainId)) throw new HttpError(502, 'sbt_rpc_wrong_chain');
  const blockNumber = safeNumber(quantity(block));
  const balances = {};
  // Include gaps in the official catalog, not just currently displayed badges.
  // Every batch is pinned to the same block; do not mix balances across heads.
  for (let start = 0; start <= maxTokenId; start += BATCH_SIZE) {
    const ids = Array.from({ length: Math.min(BATCH_SIZE, maxTokenId - start + 1) }, (_, i) => start + i);
    const count = ids.length;
    const data = '0x4e1273f4' + word(64) + word(96 + 32 * count) +
      word(count) + wallet.slice(2).padStart(64, '0').repeat(count) +
      word(count) + ids.map(word).join('');
    const result = await rpc('eth_call', [{ to: config.sbtContract, data }, block]);
    const values = decodeBalances(result, count);
    values.forEach((amount, index) => { if (amount > 0) balances[ids[index]] = amount; });
  }
  return {
    balances, blockNumber, checkedAt: new Date().toISOString(),
    maxTokenId, catalogSource: catalog.source, catalogCheckedAt: catalog.checkedAt
  };

  async function rpc(method, params) {
    const id = ++requestId;
    try {
      const response = await fetchImpl(config.rpcUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
      });
      if (!response.ok) throw new Error('http_error');
      const payload = await response.json();
      if (payload?.jsonrpc !== '2.0' || payload.id !== id || payload.error ||
          typeof payload.result !== 'string') throw new Error('rpc_error');
      return payload.result;
    } catch {
      throw new HttpError(502, 'sbt_rpc_request_failed');
    }
  }
}

function quantity(value) {
  if (!/^0x[\da-f]+$/i.test(value)) throw new HttpError(502, 'sbt_rpc_response_invalid');
  return BigInt(value);
}

function safeNumber(value) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new HttpError(502, 'sbt_rpc_number_overflow');
  return Number(value);
}

export function decodeBalances(value, count) {
  if (typeof value !== 'string' || !/^0x[\da-f]+$/i.test(value) ||
      value.length !== 2 + 64 * (count + 2) ||
      quantity('0x' + value.slice(2, 66)) !== 32n ||
      quantity('0x' + value.slice(66, 130)) !== BigInt(count)) {
    throw new HttpError(502, 'sbt_rpc_balances_invalid');
  }
  return Array.from({ length: count }, (_, i) =>
    safeNumber(quantity('0x' + value.slice(130 + i * 64, 194 + i * 64))));
}
