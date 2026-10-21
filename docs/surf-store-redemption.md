# Surf store redemption

The store allocations are independent of the Surf campaign draw.

| Reward | Allocation | Current SBT requirement |
| --- | ---: | ---: |
| Surf Mystery Box | 3 | 120 |
| Surf Pro, one month | 20 | 100 |

Both open at **2026-10-21 19:00 Asia/Taipei**, equivalent to
`2026-10-21T11:00:00.000Z`. The single release instant is owned by
`server/surf-store-release.mjs`. Availability is evaluated on each server request;
there is no deployment, cron job, client clock override, or agent wake-up at the deadline.
An open browser rechecks the server at the deadline and when the tab becomes visible.
There is no fixed closing date. Each product closes to new submissions as soon as
its allocation is fully claimed. Existing receipts remain readable after sellout.
Both store cards show a compact live remaining count beside the product title,
keeping the image unobstructed without adding a separate row or divider. The
allocation limit is available in the count's tooltip and the claim form. Sold-out
products show "fully claimed". Cards and the open email form share a count feed,
refreshed every ten seconds, on focus/visibility changes, and after submission.
Unavailable inventory is shown as an error and disables submission; configured
limits are never substituted for live quantities.

A signed-in Renaiss account may claim each product once. The same wallet cannot
claim the same product through a different account. SBT is a holding requirement;
no SBT is spent. Current holdings are checked again on submission.

Submitting a complete email address reserves an allocation immediately. Any email
provider is accepted, including Gmail, 163, Outlook, QQ and company domains. The
address should be the one used to sign in to SURF; it does not have to match the
Renaiss login address. Validation checks syntax, not mailbox ownership or existence.
The form and API share `shared/surf-store-email.js`: trim and lowercase, maximum
254 characters, a local part up to 64 characters, and a complete DNS-shaped domain.
Product writes serialize with a PostgreSQL transaction advisory lock. Unique
account, wallet, and allocation constraints prevent duplicates and overselling.
The allocation number is the authoritative order within each product. This is
the order of successfully validated requests reserving database slots, not an
ordering of browser clicks or function-local timestamps. Each product has its own
transaction lock. Network failures may require retrying; they do not grant another
allocation. A member can read their existing receipt after changing wallets.
Retrying the same account, wallet, product and email returns the original receipt;
a different email does not overwrite an existing registration.

## API and storage

- `GET /api/storefront/features`: authoritative opening state and server time.
- `GET /api/surf-store/inventory`: anonymous aggregate counts only, including before opening.
- `GET /api/surf-store/access?rewardId=...`: opening, session and SBT checks.
- `GET /api/surf-store/media`: authenticated, eligibility-gated short-lived Cloudflare URLs.
- `GET /api/surf-store/claim?rewardId=...`: the member's own receipt and inventory.
- `POST /api/surf-store/claim`: same-origin authenticated email submission.
- `GET /api/admin/surf-store/claims`: fulfillment-admin-only registration list.

All API responses are `no-store`. Claim data lives in `public.surf_store_claims`,
separately from existing shipping, VIP-ticket and campaign-draw records. The table
is included in the PostgreSQL snapshot/restore schema. The fulfillment console's
Surf store tab lists reserved allocations and email accounts for fulfillment.
The database column, API receipt and request field retain the name `gmail`, and
invalid addresses retain the `surf_gmail_invalid` error code for deployed-client
compatibility. These internal names do not restrict the provider. No existing
registration, account, wallet or allocation is renamed or rewritten.
The submission API stores registrations; it does not send email or activate Surf
memberships through a third-party API.

Private images and videos remain on Cloudflare. The application returns signed
URL metadata only; the browser downloads media directly with credentials omitted.
There is no application-server media proxy or local-file production substitute.
The box's forward and reverse clips use H.264 8-bit 1080p at 24 fps, 97 frames
each. Their timing matches the approved originals; the poster is unchanged.
The full private release is approximately 12.7 MB, including the poster.
Reveal code is loaded only after an access check succeeds. Missing media, failed
eligibility, storage failures and rendering failures surface an error.

## Deployment

Apply both `server/postgres/migrations/20261020-surf-store-claims.sql` and
`server/postgres/migrations/20261021-surf-store-email.sql` using
`node scripts/migrate-surf-store.mjs` with the intended runtime configuration before
publishing code. Set `MERCH_MIGRATION_DATABASE_URL_FILE` to the private owner
connection-string file when the runtime role has no DDL privileges. The script
checks that both credentials target the same database and endpoint, then grants
the runtime role SELECT and INSERT on the new table. Owner credentials are never
deployed; the runtime role retains its existing schema permissions. The operator
uses the direct database endpoint for schema changes. The email migration replaces
the Gmail-only CHECK constraint atomically with a provider-independent check and
a five-second lock timeout; it can be rerun and does not modify business rows.
Apply it before publishing code. Then push the approved release to the connected GitHub `main` and verify
Vercel's automatic deployment and the production domain. No direct CLI code deploy.

Production has no request parameter or environment flag for simulating the clock,
identity, holdings or claim storage. Local QA injects those dependencies through
separate temporary test programs and an isolated PostgreSQL database.
