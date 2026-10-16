# Local controls for the online Surf draw

## Operator flow

1. Open the local `/draw/#draw/surf` page and sign in to the draw room.
2. Select **連接正式開獎**. The online service opens its own login and approval
   page. It requires both draw-room access and a non-Demo Renaiss administrator.
3. Approve the displayed loopback origin, then return to the local page. The
   local controls read and operate the online authoritative ledger and signer.
4. Each formal draw action retains its existing confirmation. **鏈上重置**
   checks the current revision, chain state, request, winners and ledger before
   displaying its gas budget and a separate confirmation.
5. After a finalized reset receipt and the canonical `RoundReset` event, the
   server archives the old snapshot, winners and signed transaction journal.
   The next revision starts at ledger preparation. No follow-up action runs
   automatically.

The online `SURF_DRAW_ENABLED` gate still controls formal mutations. The reset
is blocked during an outstanding VRF request, a pending transaction, a ledger
mismatch or a signer-permission failure. Its gas budget is capped at 0.002 BNB.

## Data and access

- The ledger, signing key, transaction journal and round history stay in the
  online service's mounted database. The development database is not used for
  formal Surf controls.
- `/api/local/surf-operator/*` exists only in development and accepts loopback
  sockets, loopback hosts and same-origin mutations. Forwarding is restricted to
  the Surf draw API and the fixed `https://merch.renaisscltb.com` origin.
- Online approval uses a single-use SHA-256 proof challenge. The resulting
  one-hour grant is bound to the local origin and to the active online Renaiss
  and draw-room sessions. Credential rotation or logout invalidates it.
- Proof verifiers and grant tokens stay in development-server memory. Browser
  responses contain connection status only. A server restart requires another
  connection. Refreshing the browser retains the connection while it is valid.
- Production bundles exclude the local connection and reset controls. The
  online reset endpoint requires a scoped local-operator grant; an ordinary
  draw-room cookie or administrator session alone does not authorize it.
- Connection failures are visible and stop formal operations.

## Winner contact fields

The draw room displays recorded Email, X and Discord values. Missing values
produce no row. Email is labelled Email because the recorded domain is not
necessarily Gmail. Connected X usernames and recorded Renaiss X usernames are
both recorded identity sources; a connected X username takes precedence.

At ledger preparation, `surf_draw_contact_snapshots` captures the display
metadata beside the approved canonical ticket snapshot. It has a separate
integrity hash and does not change the ticket-ledger hash or ticket counts.
Contact snapshots remain linked to archived rounds by draw ID and preparation
time. The draw-room API requires its dedicated access session and continues to
withhold wallet addresses from its viewer projection.

Deploy this feature before preparing the current round: the current approved
round has no existing snapshot. A missing or modified contact snapshot fails
its integrity check; it is not reconstructed from a later live profile.

## Verification

Use in-memory databases and injected upstream responses for grant exchange,
session revocation, concurrency, reset finality, revision fencing and contact
snapshot integrity. These checks do not sign or broadcast BSC transactions.
Verify the actual operator connection after the authorized deployment; the
human operator completes the online access approval and any formal action.
