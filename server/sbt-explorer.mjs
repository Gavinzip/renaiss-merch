import { HttpError } from './http.mjs';

const PAGE_SIZE = 1000;

export async function readExplorerSbtBalances(wallet, config, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const signal = AbortSignal.timeout(15000);
  const balances = {};
  let latestTransferBlock = 0;
  for (let page = 1; ; page++) {
    const url = new URL(config.apiUrl);
    for (const [key, value] of Object.entries({
      chainid: config.chainId, module: 'account', action: 'token1155tx',
      address: wallet, contractaddress: config.sbtContract, page,
      offset: PAGE_SIZE, sort: 'asc', startblock: 0, endblock: 9999999999,
      apikey: config.apiKey
    })) url.searchParams.set(key, String(value));
    let payload;
    try {
      const response = await fetchImpl(url, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('http_error');
      payload = await response.json();
    } catch {
      throw new HttpError(502, 'bscscan_request_failed');
    }
    const rows = payload?.result;
    if (!Array.isArray(rows) || !(payload.status === '1' ||
        (payload.status === '0' && rows.length === 0 && /no transactions/i.test(payload.message)))) {
      throw new HttpError(502, 'bscscan_invalid_response');
    }
    for (const row of rows) {
      const id = String(row.tokenID ?? row.tokenId ?? '');
      const amount = Number(row.tokenValue);
      const block = Number(row.blockNumber);
      const from = String(row.from).toLowerCase();
      const to = String(row.to).toLowerCase();
      if (!/^\d+$/.test(id) || !Number.isSafeInteger(amount) || amount <= 0 ||
          !Number.isSafeInteger(block) || block < 0 ||
          !/^0x[\da-f]{40}$/.test(from) || !/^0x[\da-f]{40}$/.test(to) ||
          (from !== wallet && to !== wallet) ||
          String(row.contractAddress).toLowerCase() !== config.sbtContract) {
        throw new HttpError(502, 'bscscan_transfer_invalid');
      }
      const tokenId = BigInt(id).toString();
      if (from === wallet) balances[tokenId] = (balances[tokenId] || 0) - amount;
      if (to === wallet) balances[tokenId] = (balances[tokenId] || 0) + amount;
      if (!Number.isSafeInteger(balances[tokenId])) throw new HttpError(502, 'bscscan_balance_overflow');
      latestTransferBlock = Math.max(latestTransferBlock, block);
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return {
    balances: Object.fromEntries(Object.entries(balances).filter(([, amount]) => amount > 0)),
    checkedAt: new Date().toISOString(), latestTransferBlock
  };
}
