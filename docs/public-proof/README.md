# Worlds public proof verifier

Normal public entry: `/verify?event=worlds-2026&stage=final`.
The existing Merch locale, navigation shell and original six-section Fair scroll
story are retained. There is no verification sidebar link or ticket/reserve
picker. The main result animation shows the primary; verification step 5 lists
and checks every winner and ordered reserve. W/R1/R2 retain full role captions.

Submitting a request transaction hash searches all three event stages, then pins
the resolved stage, request transaction and canonical bundle hash in the URL.
A shared URL retains every explicit constraint. Old publications are fetched
with their exact identity, independently of the current round pointer. Unknown,
conflicting or ambiguous identifiers fail visibly and cannot select latest.

## Independent authority

The event source is fixed in MERCH_WORLDS_PROOF_ORIGIN. Its self-reported registry
is discarded. Operator approval separately pins chain, address, reviewed runtime
and a credential-free HTTPS public RPC. The browser reads finalized code,
receipts, events, commitments and canonical blocks directly from that RPC.

Formal BSC56 registry: `0xc96b8DeD7048841e294a1Fc11F725C045F7da8B6`.
Reviewed v2 runtime: `0xf29b1c3187bfae6858fcec596bd9196ecacc8757074dc0292d33c508aec73389`.
Source: `https://renaiss-lol.vercel.app`. At integration time all rounds await
results; no formal proof exists. The site must show waiting, not QA results.

Required active settings:
- MERCH_WORLDS_PROOF_ORIGIN
- MERCH_WORLDS_PROOF_CHAIN_ID
- MERCH_WORLDS_PROOF_CONTRACT
- MERCH_WORLDS_PROOF_RUNTIME_HASH (the legacy configuration retains its v1 default)
- MERCH_WORLDS_PROOF_PUBLIC_RPC

Both reviewed runtimes are supported. An old contract is usable only when
explicitly approved in MERCH_WORLDS_PROOF_HISTORICAL_AUTHORITIES, a JSON array of
chainId, contract, runtimeHash, publicRpc and context (`event` or `rehearsal`).
This is an address allowlist, not permission for any bundle-selected contract.
A rehearsal is labelled and never becomes the formal event's current round.
The production configuration does not import the old QA records or authority.

Registry round identities bind event, stage and sequence. The existing v1
six-word ticket leaves, SHA-512 rejection sampling, forward Fisher–Yates and
one-primary/two-reserve policy are retained. The original legacy proof format
remains valid. Source hashes are in `source-provenance.json`.

## Public endpoints

- GET /api/public-proofs/worlds-2026/rounds
- GET /api/public-proofs/worlds-2026/{quarter|semi|final}/history
- GET /api/public-proofs/worlds-2026/{stage}/bundle

Bundle selectors are bundleHash, tx and roundId; all supplied identifiers must
agree. download=1 returns the same canonical bytes as an attachment. Only these
fixed public upstream paths are allowed. Cookies, auth, admin paths, arbitrary
origins and redirects are never forwarded. JSON size is bounded at 32 MiB.
HTML/API responses are not long cached.

## Media and verification

Five licensed font/art assets are versioned in existing public R2 under
`public-proof/fair/v1/r519087e5a9ed18b29d80`. Production requires the matching
VITE_PUBLIC_PROOF_MEDIA_CDN_BASE_URL. Missing publication fails the production
build; there is no local-media production fallback. Original/source/QA media
is not copied to public or dist. The catalog records exact encoded hashes.

`npm run proof:test` covers legacy/v2 identities, authoritative runtime/address
selection, exact historical downloads, cross-stage hash lookup, tampering,
rejection-sampling equivalence, six sequential checks, SSR presentation and
cancelled HTTP streams. Synthetic fixtures are limited to these isolated tests.

Real browser six-step checks use the original independent mainnet rehearsal at
separate localhost QA ports. Formal-source previews verify waiting and empty
history; no chain request is sent to manufacture a formal proof. This verifies
the published-proof path, not completeness of future official rosters or prize
fulfillment. Actual user visual acceptance remains separate.

Existing Store, Surf quotas, Gmail/email handling, login, eligibility, voting,
shipping and formal participant records are outside this change.

The server control plane loads only the two reviewed build manifests through
`runtime-catalog.mjs`. It does not import the browser/CLI cryptographic engine.
Vercel explicitly packages this metadata and the existing backup tools. This
separation prevents a vendor TypeScript packaging omission from failing shared
API initialization. Cryptographic verification remains in the original Worker.
