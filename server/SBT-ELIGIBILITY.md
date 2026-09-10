# SBT eligibility sources

The owner-selected policy is `dual-source-max-v1`: wait for both sources and use
the result with the larger **distinct owned badge count**. Do not sum the counts,
union owned IDs to invent a third count, or maximize each token's balance.
On a count tie, choose the larger total balance; on a complete tie, use RPC.
This is an availability/product policy, not a mathematical guarantee: a stale
explorer overcount can win after a balance migration.

## Data path

- `sbt-explorer.mjs`: fetch all Etherscan v2 `token1155tx` pages for the server's
  authenticated wallet and configured contract; reconstruct the legacy balance.
- `sbt-catalog.mjs`: discover `SBT_BADGES` in the current Renaiss achievements
  page's public JS bundles, parse literal IDs without executing remote code, and
  obtain the maximum ID. This is a **frontend catalog**, not an on-chain total or
  a guaranteed complete registry. It may miss IDs not yet published there.
  The immutable filename is discovered dynamically, never pinned to a release.
  A fixed structured catalog API should replace this adapter if one is offered.
- `sbt-onchain.mjs`: read `eth_chainId`, `eth_blockNumber`, then
  `balanceOfBatch(address[],uint256[])` for IDs 0 through the catalog maximum,
  including catalog gaps. Use batches of 512 pinned to one block.
- `sbt-dual-source.mjs`: run explorer and catalog/RPC work concurrently and wait
  for both before selecting the maximum. Both original counts, their observation
  times, the RPC block, scanned maximum and catalog URL are kept in the result.

No single-source fallback: timeouts, malformed responses, missing catalogs and
wrong-chain RPC responses fail visibly. No cached failed or partial result is
returned. A catalog above ID 10,000 fails instead of silently truncating the scan.

## Configuration and caching

Existing `BSCSCAN_API_KEY`, `BSCSCAN_API_URL`, `BSCSCAN_CHAIN_ID`,
`ONCHAIN_SBT_CONTRACT`, and `MERCH_SBT_CACHE_TTL_SECONDS` settings still apply.
`ONCHAIN_SBT_RPC_URL` optionally selects the RPC provider; its default is
`https://bsc-dataseed-public.bnbchain.org`. The discovered catalog belongs to the
Renaiss BSC SBT collection, not arbitrary ERC-1155 contracts.

Successful paired results are cached server-side by wallet, contract, chain and
source endpoints for 60 seconds by default, with concurrent requests coalesced.
After the Store resolves an authenticated wallet, it calls
`/api/merch-eligibility/prepare` in the background after the first paint. This
warms the shared count cache only: it does not persist product access or change
sealed covers. A concurrent Check Access joins the same in-flight scan. Logged
out users cannot scan a wallet through this endpoint. Background errors do not
grant access; the explicit check may retry and surfaces any continuing failure.
The public catalog is shared across wallets and rechecked after 60 seconds.
Check Again sends `refresh=1`, bypassing wallet-result and stored-proof caches;
the shared catalog's short TTL still applies.

Old explorer-only snapshots are not reused as proofs or restored as unclaimed
Store access. Permanent claim entitlements remain untouched. New paired proofs
retain the existing same-wallet/same-contract higher-tier reuse rule; their
freshness starts at the original verification time, not each reuse/save.

No ownership numbers, token ranges or source selection are accepted from the
browser. The browser can only ask to refresh its authenticated session's wallet.
