# Transaction-first public verification

Normal entry: `/verify`. A blank URL (including an old event/stage-only link)
performs no proof lookup and does not select a default event or latest round.
The original Merch application, navigation, locale and six-stage proof animation
remain in use. Event-specific controls are absent from the entry.

`GET /api/public-proofs/resolve?tx=0x…` locates a registered event and exact
record. `bundleHash`, `event` and `stage` are optional constraints for historical
links; supplied constraints must agree. Request transactions, round-commitment
transactions and per-match roster-commitment transactions are supported by the
current Worlds adapter. The resolved proof hash is pinned in shared draw URLs.
No lookup creates or modifies an event record or blockchain transaction.

## Event adapters

`server/public-proof/registry.mjs` is independent of tournament stages and event
names. It queries registered adapters, rejects ambiguous identifiers, and does
not skip unavailable sources to manufacture a unique match. Lookup establishes
record identity; it does not constitute cryptographic verification.

The current production integration is **Worlds 2026 only**. This change does not
automatically reinterpret KBW, Surf, football, Pokémon or future event proofs as
Worlds proofs. To onboard an event:

1. Register its event descriptor and server resolver. Keep its source origin,
   public index schema and supported transaction/event ABI in that adapter.
2. Independently approve its chain, contract, reviewed runtime and public RPC.
   Never take authority from a source response, proof bundle or visitor URL.
3. Connect a client loader and verification Worker for the actual versioned
   proof format, and its result presentation. Keep its original randomness,
   byte encoding, selection and Merkle rules.
4. Check exact historical identities, ambiguity, tampering, unavailable sources,
   unpublished proofs and the real published proof against finalized chain data.

Visitors continue using the same transaction input; they do not select events
or tournament stages. A newly registered server adapter without a connected
client verifier fails visibly. There is no default Worlds verifier.

## Current adapter boundaries

`worlds-adapter.mjs` reads only the fixed public history paths at the configured
Worlds source. It never forwards cookies, Authorization, arbitrary URLs or
redirects. Index bodies are capped at 2 MiB and 10,000 records per stage.
Canonical proof downloads retain their existing 32 MiB bound and hash checks.

For a commitment transaction absent from the published request index, the
adapter reads its successful finalized receipt, approved contract runtime and
canonical block from approved public RPCs. Runtime is checked at a finalized
checkpoint, matching the browser verifier; public nodes need not provide old
account-state snapshots. The exact commitment transaction must also be present
in the downloaded proof, or the exact roster record, before verification starts.

The existing Worlds relay and fully pinned match-snapshot URLs remain valid.
The browser still independently executes the original six proof steps. Old
published proofs retain their committed rules; no result or reserve is altered.

## Local review, 2026-11-04

Checkout: `codex/merch-generic-verifier`, based on freshly fetched `origin/main`
`1438030f20a3fe7ab804ee20e982faecdc75d53b`. Existing uncommitted test-round work
in the separate `public-proof-registry` checkout is preserved.

Port 5440 uses the original Merch server and real production public proof
source. Port 5441 uses the same built product with a private copy of the original
2026-10-28 mainnet rehearsal database served by the normal Worlds API on 3318.
That archived source retains its original `preview/fixtures` identity and is
labelled rehearsal; its published bytes and real chain transactions are retained.
No new draw or chain transaction is sent. No production data is written.

Initial review was local technical validation, separate from production and user
visual acceptance. Gavin authorized push and production deployment on 2026-11-04.
Release checks must verify the live commit, canonical domain, old pinned Worlds
links, public media and mobile rendering; a successful build alone is insufficient.
