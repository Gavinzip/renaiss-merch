# Surf draw operator login

## Operator flow

1. Open `/draw/#draw/surf` and enter the draw-room username and password.
2. The same login authorizes Surf formal operations. There is no Renaiss SSO
   administrator login, connection button, approval popup or second password.
3. Review the prepared participant snapshot, then select **提交已確認帳本**.
   Committing the ledger, requesting VRF, revealing prizes and resetting each
   retain their own confirmation and on-chain preflight.
4. All 27 Surf prizes share one VRF request. Each prize group reveals all its
   remaining slots in one transaction: 7 Mystery Boxes, then 20 memberships.
   The API rejects partial group selections. There is no quantity control.
   Mystery Box cards flip individually; memberships use **全部翻開**, which
   flips the confirmed cards together without submitting another transaction.
5. Development-loopback pages also show **鏈上重置**. Production has no reset
   control. Reset archives the prior snapshot, contacts, winners and transaction
   journal only after a successful finalized receipt and canonical reset event.
   No next chain action runs automatically.

## Local transport and authorization

The local login authenticates directly against the fixed online service,
`https://merch.renaisscltb.com`. It obtains an origin-bound operator token in
server memory and issues a separate local HttpOnly cookie. Browser responses
contain only authentication status and username, never the online token,
signing key or online session cookie. Passwords are not retained after login.

The online service verifies its configured password hash and applies the same
login throttle as normal draw-room login. Delegation is bound to that live
session, its expiry and current credential fingerprint. Logout revokes it.
Restarting the development server requires signing in again; a browser refresh
retains authentication while the development server and online session live.
A missing deployment or failed connection is an explicit login failure.

`/api/local/surf-operator/draw*` is development-only and checks loopback socket,
Host and same-origin mutations. Its fixed allowlist contains Surf operations
only. The online reset endpoint additionally requires the scoped loopback-origin
token. An ordinary online cookie cannot invoke reset.

The dedicated credentials grant Surf draw access only. They do not grant
Renaiss SSO, fulfillment, shipping or other site administration permissions.
The approved signing key, authoritative ledger and transaction journal remain
online in the Zeabur service's mounted database. There is no local ledger or
signing fallback. `SURF_DRAW_ENABLED` and canonical signer permissions still
control every formal chain operation.

## Winner contacts

Cards display recorded Email, X and Discord values, omitting missing fields.
At snapshot preparation, `surf_draw_contact_snapshots` captures immutable
contact metadata with its own integrity hash, without changing ticket-ledger
hashes or counts. Connected X takes precedence over recorded Renaiss X.
Missing or modified snapshots fail integrity checks. Wallets remain omitted
from the draw-room viewer projection.

## Verification

Use in-memory databases and injected upstream responses to check credential
verification, failed-login throttling, token confidentiality, origin binding,
logout, credential rotation, expiry and reset access. Preserve the existing
revision fencing, signed-intent recovery and finalized-reset archival tests.
These checks must not broadcast a transaction. Preparing the approved private
snapshot is separate from the operator's first chain confirmation.
