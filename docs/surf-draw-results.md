# Shared on-chain results for Surf

## Release status — 2026-10-16

Implementation and isolated-EVM verification are complete. The approved shared
result contract was deployed to BSC mainnet and its exact source/compiler
settings were independently verified on BscScan. Production pins this address:

- Results: `0x86Ac5b8B6119b568202bB695FC337741C18a5128`.
- Deployment transaction:
  `0x5eefec22c5bc9e6dfa647cae9587f58d3097f42c4909b17e8b626c820ebe3637`.
- Finalized deployment block: `127925624`.
- Actual deployment gas: `976732` at `0.05 gwei`, totaling `0.0000488366 BNB`
  (approved fee cap: `0.0002 BNB`).
- [Verified source](https://bscscan.com/address/0x86Ac5b8B6119b568202bB695FC337741C18a5128#code).

No formal Surf ledger commitment, VRF request, or reveal was sent during the
tests or deployment. The release handoff stops at `提交已確認帳本`.

The canonical source remains
`0x78b79dB5726700BeDb18BC05aA612b11E33B00A9` on BSC 56. It commits the ledger
and requests/receives the single VRF word. `RenaissDrawResults` publishes the
same primary ticket selections efficiently, using the reviewed Pokémon 30th
`TicketRankSelection` implementation. Ticket count, prize count, ledger hash,
draw ID, and fulfilled randomness are read from the canonical source. They are
not fixed to the Surf event in the result contract.

Each ticket can win once. Different tickets owned by the same person remain
eligible. There are no reserves. Changing which group is published first does
not change the winner assigned to any prize slot.

## Authority and generations

The result identity hashes BSC chain ID, source address/runtime hash, draw ID,
ledger hash, and VRF request ID. A source reset clears the active request; a new
request uses a new identity. Old results remain queryable on-chain and in the
private archived round. No deployment or result deletion is needed for a reset.

The result contract checks canonical `isAdmin` for every write, the exact source
runtime, fulfilled source state, ledger/request expectation, and absence of
results published through the original selector. Duplicate or stale prize slots
revert. It computes all tickets once and publishes only the requested slots.

The server accepts one configured `SURF_DRAW_RESULTS_ADDRESS`, verifies its
exact compiled runtime and source binding, and never invokes the original
selector as a fallback. Missing configuration disables formal writes; after a
round starts it prevents unverifiable result reads. Finalized blocks, receipt
target, event emitter, request/result identity, prize order, and tickets must
match before a reveal transaction is marked confirmed.

The original source stays in randomness-ready state after optimized publication.
The API exposes both `sourceState` and result completion. The UI says Complete
when all result slots are published and separately shows the source's real state
in the proof panel.

The result contract cannot freeze the original selector or prevent another
deployment. The application pins the accepted address; contradictory original
source results stop verification. The stable draw/prize slot remains the prize
identity, so another proof address cannot create an additional entitlement.

## Verified compiler and runtime

- Solidity: `0.8.24+commit.e11b9ed9`, optimizer 200, Shanghai, IPFS metadata.
- Contract runtime: 4,251 bytes.
- Runtime hash:
  `0xc184ece3cbf1e6b5e6a0402c1efbf62e58c29880dbbc00141c1ff4c8fd2ba380`.
- Standard compiler input SHA-256:
  `f5a810bad27561cba8b8ff27e40da6f0197ffdb74d0fe80699664e3022a68d7f`.
- Build config: `contracts/draw-results/compiler.json`.
- Reproducible runtime/ABI/creation manifest:
  `shared/draw-results-contract.json`.
- `npm run contracts:check` recompiles and rejects a stale manifest. The frontend
  build runs this gate. Compiler and Solidity sources are not bundled into the
  frontend or served as public media.

## Isolated verification

The local EVM used the exact production source runtime, 6,506 synthetic tickets,
and a mock VRF coordinator. No private campaign identities were used. The gas
limit was enlarged only to measure the otherwise failing original algorithm.
These are QA seeds, not official randomness or winners.

| QA seed | Original 7 boxes | Original next 20 Pro | New 7 boxes | New next 20 Pro |
| --- | ---: | ---: | ---: | ---: |
| 123456789 | 30,536,441 | 373,823,992 | about 1.17M | 627,282 |
| 1131 | 71,645,259 | 504,842,416 | 1,176,003 | 627,282 |
| 1990 | 39,687,235 | 463,690,416 | 1,172,314 | 627,282 |

All 81 prize selections matched the original bytecode exactly. Publishing Pro
first consumed 1,528,574 gas and preserved every prize/winner identity. The
original single-slot failure case was also retained in the gas investigation.

The complete server-signing cycle passed: immutable private snapshot, source
finalize, one VRF request, 7 results, 20 results, receipt reconciliation, refresh,
private email/X/Discord mapping, source reset, archived database records, new
request, and fresh results. Repeated intents reused one transaction hash.
Unauthorized callers, duplicate/out-of-range slots, wrong ledger/request,
changed source runtime, missing/wrong result runtime, and altered receipts were
rejected. The same engine also handled an independent synthetic event with
1,000,000 tickets and 256 prizes (23,250,079 gas for full publication).

Deployment-tool QA proved read-only default behavior, exact approval-hash
checking, private durable signed-intent storage, runtime verification, and
idempotent resume. The browser displayed 27/27 results and separate source/result
proofs. The screenshot is explicitly labeled isolated EVM, not BSC mainnet:
`work/draw-copy-preview/surf-optimized-results-evm-proof-20261016.png`.

## Deployment procedure

1. Obtain explicit BSC deployment approval and scoped Git push approval. The
   last live read found Surf source Draft, request 0, winners 0. Recheck before
   execution. Do not execute a formal draw as a deployment test.
2. Use `scripts/draw-results/deploy.mjs` or the same exported server utility.
   Default behavior is read-only preflight. Broadcasting requires the exact
   reviewed input hash in `DRAW_RESULTS_DEPLOY_APPROVAL` and a durable
   `DRAW_RESULTS_DEPLOY_JOURNAL_DIR` on the Zeabur mounted disk. The signer stays
   in the existing server environment. Deployment has no constructor arguments,
   sends zero BNB value, and caps gas fees at 0.0002 BNB.
3. The live preflight estimated 985,651 gas, a 1,182,781 gas allowance, and
   0.00005913905 BNB maximum at the observed gas price. Re-estimate at execution;
   this is not a fixed-price promise. Reconcile a saved intent before retrying.
4. Publish the exact compiler input through `scripts/draw-results/verify.mjs
   --submit`, with the existing explorer API credential in the process. Confirm
   final verification and independently compare published sources/settings.
   The script follows the official [source verification API](https://docs.etherscan.io/api-reference/endpoint/verifysourcecode)
   and [published-source API](https://docs.etherscan.io/api-reference/endpoint/getsourcecode).
5. Pin the verified deployment address with `SURF_DRAW_RESULTS_ADDRESS`. The
   result contract needs no VRF subscription registration or additional admin
   grant; requests and roles continue to use the canonical source.
6. Push the scoped release and wait for GitHub/Dockerfile deployment, RUNNING,
   health, current hashed assets, cache/compression, and authenticated live
   browser verification. Stop at `提交已確認帳本`.

No application media was added. The isolated production build passed static
media/CDN assertions; the draw JS was 103.20 kB (36.64 kB gzip) and its CSS was
83.08 kB (16.11 kB gzip). Existing lazy Three/shader chunks were unchanged.
