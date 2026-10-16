# Surf campaign close enforcement

The campaign closes at the instant in `shared/surf-campaign.js`. The server
enforces that instant through `server/missions/campaign-window.mjs`.

After closing:

- Account verification and social connect, verify, disconnect and OAuth callback
  routes reject further changes with `surf_campaign_closed`.
- Storage checks reject in-flight verification results and connection writes,
  account binding, operation leases and manual approvals.
- Participation synchronization returns the existing recorded participant.
  Mission-state reads cannot change tickets, identity or audit history, and
  cannot add a new participant.
- Existing task/ticket records remain readable for the operator and participant.

On 2026-10-16 the operator explicitly approved using the current production
ledger, including tickets already recorded after the original close instant.
Do not remove those tickets or reconstruct an earlier ledger. At verification
the ledger contained 2,434 eligible participants and 6,504 tickets.

This enforcement preserves those existing records. The normal draw prepare
action still checks the reviewed candidate hash and creates the immutable
snapshot in a transaction. Deploying this fix does not prepare that snapshot,
enable formal draw actions, sign a transaction, request VRF or select winners.

Verification uses isolated in-memory SQLite databases: the exact close boundary,
unchanged existing tickets/identity, late participant rejection, in-flight write
rejection, manual approval rejection and mutation-route rejection. No production
participant data is used in these tests.
