# Surf Chainlink formal redraw

The original Chainlink round (`RENAISS_SURF_V1_CHAINLINK_ROUND_3`) published all
27 prizes. Its deployed source is immutable and cannot reset. The redraw uses
`RENAISS_SURF_V1_CHAINLINK_REDRAW_ROUND_4` on a new
`ChainlinkSurfDrawReusable` source. The old contract, 27 published results,
transaction rows, and locked snapshot remain available for audit.

The authenticated `/draw/` operator sees **重新抽出 27 個獎位** when the server
has verified the old round is complete, the new source is fresh and owned by
the same signer, and no draw transaction is pending. Clicking it displays the
old and new draw identities and the frozen list totals, then copies the
canonical entries, rules, prizes, and contact snapshot to the new draw ID.
Only the draw ID and commitment hash change. This cutover does not broadcast a
transaction or request VRF. The operator then uses the ordinary ledger,
request, and reveal buttons; the server never repeats those actions on its own.

The reusable source has `resetDraft(drawId)` for later full redraws from the
same frozen list. A confirmed `RoundReset` event archives the signed
transaction history and on-chain state before incrementing the local
revision. The reviewed snapshot and contacts remain fixed. A callback for an
abandoned request is ignored unless its unique request ID matches the current
request. Only the same authenticated draw-room operator can reach these
server actions; POSTs must be same-origin and contract transactions require
the authorized BSC signer.

## Release sequence

1. Compile and inspect `shared/chainlink-surf-reusable-contract.json`; verify
   the old Chainlink manifest has not changed.
2. Push the scoped source after operator approval and wait for the Dockerfile
   GitHub deployment and health checks.
3. On the deployed service run `node scripts/chainlink-surf/deploy-reusable.mjs`
   to estimate the BSC cost. It does not broadcast without `--deploy` and caps
   gas at 0.001 BNB.
4. After approval for the exact deployment, run with `--deploy`, record address,
   transaction, and runtime hash. Set `SURF_CHAINLINK_REDRAW_SOURCE_ADDRESS`
   and `SURF_CHAINLINK_REDRAW_RUNTIME_HASH` on the service. Never print the
   operator private key.
5. Verify the new source's chain ID, draw ID, wrapper, owner, code hash, and
   state 0. Check the existing 27/27 old round still appears online. Leave the
   redraw button for the operator to press.
