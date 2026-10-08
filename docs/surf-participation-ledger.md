# Surf participation ledger

## Participant verification

The campaign shows the recorded ticket count, saved time and a check mark for
each verified task. The mandatory Renaiss + Surf account task grants one ticket;
verified Surf X follow and Discord membership each grant one more, up to three.
Tickets require a valid Safe wallet from the trusted Renaiss SSO session. The
address is the participant's wallet, not a postal shipping address.

All checks continue to use the existing provider APIs. Client-supplied names,
wallets, email addresses, task flags and ticket counts cannot issue tickets.
Names, wallet and linked X profile come from SSO; social IDs and usernames come
from authenticated X/Discord connections. No Demo participant enters the ledger.

X verification must use the X account in the trusted Renaiss profile. The task
allows an account change before the first successful check. A successful check
permanently locks the provider user ID for this campaign, including after
refresh, token expiry, a failed recheck or a changed Renaiss binding. Renewing
authorization for that same provider identity remains possible; replacing or
disconnecting it is rejected on the server. OAuth callbacks reject a
different X account before saving credentials, and verification checks reject
an existing mismatch before refreshing credentials or calling the follow API.
An identity mismatch cannot retain the X task's ticket. Missing X bindings must
first be completed in Renaiss, followed by a fresh Renaiss sign-in.

Provider checks have a 15-minute freshness window. A cached result expiring does
not erase previously recorded tickets. A provider outage or expired authorization
is recorded as an unsuccessful recheck, with the previous confirmed grant kept
for the same identity. Renewing an X or Discord token for the same provider ID
also retains the previous result while the next network check is pending.
A definitive failed task, identity change, disconnection
or changed verification target/policy removes that task's grant. Failure of the
mandatory accounts task sets total tickets to zero. Every change is audited.

Repeated checks cannot add extra tickets. One Safe wallet, one Surf email and
one social provider identity cannot earn tickets for multiple participants.

## Mounted database

These tables share the existing SQLite database configured by
`MERCH_CLAIM_DB_PATH` (`/data/merch-shipping-claims.sqlite` in production):

| Table | Contents |
| --- | --- |
| `mission_participants` | SSO user ID, name, Safe wallet, email, Renaiss X profile, verified social IDs/usernames, three task records, total tickets, timestamps and rule version |
| `mission_x_identity_locks` | First successfully verified X provider user ID and verification time; retained when check status changes |
| `mission_result_history` | Provider response/evidence for every new check, including failed checks |
| `mission_participation_events` | Participant record before and after each change |
| `mission_participant_exports` | Export ID, administrator, scope, participant/ticket totals and the complete immutable JSON snapshot |

OAuth credentials remain encrypted in `mission_connections`; participant APIs
and CSV exports never include access tokens, refresh tokens or raw evidence.
The participant API exposes only the current signed-in person's record.

Existing provider records are migrated when the administrator first opens the
list. The latest stored trusted SSO profile supplies their identity. If that
profile no longer exists, the record is retained with zero tickets until the
person signs in; no wallet or profile is fabricated.

## Administrator table and exports

The existing `FULFILLMENT_ADMIN_SAFE_WALLETS` allowlist protects both the table
and export API. Administrators can open **抽獎名單 / Participants** from the Surf
campaign header, or **出貨管理 → Surf 抽獎名單** from Store.

- `GET /api/admin/missions/surf/participants?page=1&search=...`: paginated table,
  full wallet, profile, provider IDs, task flags and ticket totals.
- `POST /api/admin/missions/surf/participants/export?scope=eligible`: UTF-8 CSV
  of participants with tickets, one row per participant with a `tickets` column.
- `POST /api/admin/missions/surf/participants/export?scope=all`: all records,
  including pending and zero-ticket participants.

Exports require a matching Origin and use `no-store, private`. Each CSV includes
an export ID and latest provider outcomes/reasons/check times. The server stores
the exact export snapshot; future checks do not modify a past export. CSV cells
are quoted and spreadsheet formula prefixes escaped. Exporting a list does not
execute or finalize a draw.

## Google Drive backups

The existing `.github/workflows/offsite-backup.yml` protects the entire database,
including participant records, verification history and export snapshots.

- Every hour at minute 20: SQLite online `.backup` snapshot, then encrypted
  restic backup over rclone to the Merch-specific Google Drive repository.
- Monthly: repository integrity check plus a 5% sample of encrypted data packs.
- Retention: 48 hourly, 14 daily, 8 weekly and 12 monthly snapshots, unless the
  existing retention environment variables override them.
- Manual: dispatch `Offsite backup` with `operation=backup` or `operation=check`.
- Authenticated internal endpoints only; credentials stay in Zeabur/GitHub
  secrets. Unauthenticated backup requests must return 401.

The independent local restic password escrow is `.secrets/restic-password`,
excluded from Git, mode 0600 within a 0700 directory. Keep the mission encryption
key independently recoverable too; it is needed to decrypt restored OAuth data.

For recovery, select a restic snapshot, restore to an isolated directory, and
run SQLite integrity checks before stopping the application and replacing its
database. Preserve the current database first and restore compatible application
credentials. Do not overwrite an active WAL database or copy only its main file.
Recheck health, participant totals and the chosen export snapshot after restart.
