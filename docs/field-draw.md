# Independent on-site draw room

The normal product entry is `/field-draw/` (including direct refresh). It uses
`draw/index.html`, the original draw-site shell and the existing Renaiss foil
pack, picker, manual tear, landscape extraction and individual flip. No public
Hub menu is added. `/draw/` retains the existing Surf/Charizard room.

## Configuration

Required for this room:

- `FIELD_DRAW_ACCESS_USERNAME`: 3–64 letters, digits, `.`, `_`, or `-`.
- `FIELD_DRAW_ACCESS_PASSWORD_HASH`: existing `scrypt-v1` format, generated using
  `hashSurfDrawPassword` in `server/surf-draw/access-credential.mjs`. Pass the
  password through a private operator process; never commit plaintext or hashes.
- `FIELD_DRAW_DATABASE_URL`: PostgreSQL URL for the field room application role.
  Certificate verification is always `verify-full`. This can target a dedicated
  database or the same cluster with its own restricted role and `field_draw`
  schema. There is no implicit use of `MERCH_DATABASE_URL`.

Missing credentials show an explicit configuration message. Missing database
configuration fails visibly. No local-file or memory storage fallback is used.
The session lasts 12 hours and is HttpOnly / SameSite=Lax / Secure on HTTPS.
Changing the configured credential invalidates existing sessions. Login is
limited to five attempts per 15-minute address window. Mutations require the
configured same origin. Renaiss SSO and the Surf-room cookie do not grant access.

Run the explicit migration with an owner URL kept outside Git:

```sh
FIELD_DRAW_MIGRATION_DATABASE_URL_FILE=/absolute/private/owner-url \
  node scripts/migrate-field-draw.mjs
```

The script loads local env configuration, checks that owner and application URLs
target the same host/port/database, creates only `field_draw` tables and grants
CRUD/sequence access to the application role. Runtime code never creates tables.
For production, set these variables in the existing GitHub deployment service
and apply the migration there after reviewing the target. Follow the project's
PR → authorized merge → automatic deployment sequence; no branch production
release is authorized by this document.

## Data and flow

1. Sign in using this room's account/password.
2. Visit `/field-draw/roster/` directly. Paste a round title and one name per line, or upload UTF-8
   CSV/TSV/TXT (1 MB / 10,000 entries). Both use `shared/roster-draw.js` validation.
3. Preview the entry count and names, then confirm persistence on the server.
   Repeated names are separate entries; explicit file IDs must be unique.
4. Visit `/field-draw/` directly; no navigation tabs or prize input are shown.
   Browse and click a physical pack, manually pull its seal, then flip the card.
   A partial tear below 90% stays paused; at 90% the original animation completes
   the final 10%. Clicking alone does not finish it.
   The server saves a `crypto.randomInt` selection before opening the pack.
5. Saved winners are excluded from the current round. Stable request IDs make
   uncertain retries idempotent; stale counts/round IDs cannot consume or clear
   a newer state. Transactions serialize reads and writes by schema.
6. Refresh restores the roster and history. **重播** uses the saved result and
   **下載 CSV** exports it without another draw; CSV cells are formula escaped.
7. **結束本輪並更換名單** archives the old roster and preserves winner history.
   Upload a new list to start a new round with independent eligibility.

Demo is an explicitly marked synthetic winner in the actual room UI. It makes
no draw request and does not change eligibility or saved results. It is separate
from persisted winners. Field storage uses only the `other` presentation kind;
Charizard requests are rejected by this room's API. The underlying repository
and auth implementation are shared, while cookies, credential fingerprints,
API roots, tables and transaction locks are independently scoped.

The draw entry includes a pre-bundle loading/error/retry panel. This is a startup
safeguard; it does not substitute data, authentication or rendering when they fail.

## Verification

`tests/field-draw/integration.test.mjs` uses actual certificate-verified PostgreSQL
and HTTP routes. It requires an explicit disposable database owner URL file via
`FIELD_DRAW_TEST_DATABASE_URL_FILE`; it never reads the production database URL.
It creates `field_draw_test_20261122` and `legacy_draw_test_20261122`, refuses to
overwrite either, and leaves them for explicit inspected cleanup after the run.
Do not run it against a production database.

### Local review, 2026-11-22

- Checkout: `/Users/gavin/renaiss-merch`, branch
  `codex/local-live-sync-20261120`, base `abce6596`; this build includes local
  uncommitted changes. No Git upload, PR, merge or production deployment occurred.
- Production build and media audit passed. The draw entry is 105.42 kB
  (37.25 kB gzip); no new static media was introduced. Existing shared large-chunk
  and JSON import-attribute build warnings remain; the 61 public-proof checks pass.
- Six PostgreSQL/HTTP integration checks passed. Actual browser flow passed:
  server login, pasted preview/confirm, selection, manual partial tear/pause/resume,
  saved draw, landscape card/flip, reload, replay, CSV download, archived first
  round, CSV import of a second round, Demo and logout. The original winner
  count stayed one across replay/Demo; the second round stayed at zero winners.
- Repeated entry with the supplied operator account passed after replacing the
  temporary test account. The account is configured only in ignored local env;
  production credentials and the production database migration remain release work.
- A temporary server using the same built entry rejected its main module once.
  The entry displayed a readable failure/retry state, then recovered on retry.
  The temporary fault server was stopped; the normal preview remains on 5173.
- Local HTTP checks: HTML/auth/API use no-store; hashed draw JS returns gzip and
  immutable caching; missing nested scripts/routes return 404, protected roster
  APIs return 401 without a session. No browser application errors were observed.
- Responsive viewport control did not apply to the target tab in the current
  browser tool. Only desktop rendering is verified; phone/WebKit device coverage
  remains pending. No mobile pass is claimed.
- Both disposable test schemas, temporary QA account/file/CSV artifacts and the
  three QA data rows (active roster, archive, winner) were removed after the
  announced cleanup. The local PostgreSQL volume and app configuration remain
  for review; existing Surf/Charizard data was never modified.
- Preview: `http://localhost:5173/field-draw/`. Planned production route:
  `https://merch.renaisscltb.com/field-draw/` (not released).

### Follow-up UI correction, 2026-11-22 evening

The user rejected the undersized pack and explicitly requested the Four.meme
reference presentation. The dedicated field room now uses these direct URLs:

- `/field-draw/`: draw, without navigation tabs or a prize field.
- `/field-draw/roster/`: roster management, without a link back to the draw.

The picker instruction, arrows, counter, rotate and choose buttons are removed
from this room. Direct physical-pack selection/rotation/browsing, accessible hit
targets, manual tearing and Escape to return to the carousel remain available.
Every real draw uses the fixed `現場抽獎` prize label and appends its saved winner
history. Earlier rows remain in place during later openings; the new winner is
withheld from the visible history until its deliberate flip finishes.

The presentation was compared with the existing Four.meme travel-draw source and
its real-product review screenshots in the `bbw-travel-ticket-frontend` checkout.
The shared physical pack restores its approved .061 pillow, .02 waist, joined
foil seams, soft contact shadow/reflection and foil sweep modules. The existing
Renaiss artwork and host background remain. No Four.meme artwork, draw logic,
credentials or business records were copied. The reference checkout was read-only.

The field stage now owns its bounded `svh` dimensions instead of subtracting its
scrolling document position and then another 80px of inner padding. At the same
673×854 viewport, the resting main pack changed from about 132×245 to 217×404 CSS
pixels. The landing card can use up to 680px while retaining its 1.6 aspect ratio.
Canvas/camera bounds account for the highest flying card and loose foil.

One shared `PRO_TEAR_FINISH_AT` constant controls the explicit 90% threshold.
Partial tears stay paused, and pointer travel is measured from the actual grab
position to the visible endpoint. Crossing 90% starts the existing physical
opening timeline; the remaining 10% animates automatically. A click alone does
not advance or finish a partial tear. This supersedes the former 100% requirement
for this implementation; it does not silently alter the global skill snapshot.

A viewport/scroll regression exposed an incorrect non-intersecting observer
entry while the perspective stage was visibly onscreen. Stage bounds are now
the activity authority; intersection/scroll/resize events only request an
activity check. They never resize or recenter the physical pack on page scroll.
Hidden documents, inactive panels and genuinely offscreen stages still pause.
The stored result survives even if presentation is interrupted and can replay.

Validation of the revised UI:

- Direct authenticated draw and roster URLs both return the normal product;
  the roster API still returns 401 without a session. Navigation, prize input
  and picker controls have zero rendered instances in the field draw.
- 1024×768 and 390×844 browser viewports were exercised. At 390px the document
  stayed 390px wide. These are responsive browser checks, not physical-phone QA.
- Manual half-tear, a click without movement, an off-centre resumed grab below
  90%, and automatic completion after crossing 90% passed. A half-tear remained
  at its saved position while scrolling; the pack-local dimensions stayed fixed.
- The observer regression was reproduced, repaired and retested by scrolling
  away/back, resuming the half-tear, completing extraction and flipping the saved
  second result. The subsequent real third draw also completed through its flip.
- Three distinct QA entries were persisted, prior results stayed visible during
  later openings without revealing the new name early, and a page reload retained
  all three records. The exact named QA roster and its three results were removed
  after announcing the cleanup. Existing activity records were not touched.
- Production build/media checks and diff checks passed. The browser preview is
  retained on the normal draw URL for user review; no push, PR or release occurred.

### Card/foil intersection correction, 2026-11-22

The former Renaiss single-card adapter shortened full pouch withdrawal to .18
pack widths and its final drop to .22 pack widths. The landscape card began
turning and growing while still overlapping the pouch. Prior final-frame review
did not establish intermediate clearance; this correction supersedes that claim.

Reuse the current Four.meme `src/flagship/thailand/pack/foil/` release calculation
from `createSingleFoilBooster.ts` and its `proBoosterTimeline.ts`: retain full
withdrawal, then compute enough downward travel to leave the actual drawing
surface. Mouth and detached-strip timing follow that source. Landscape flight,
Renaiss artwork, 90% handoff and independent server draw/auth remain intact.
The field canvas includes the visible viewport bottom without rescaling the stand.

`node --test tests/field-draw/pack-clearance.test.mjs` passes six checks: actual
foil vertices versus transformed card corners across five layout sizes, plus a
negative control that reproduces the former overlap. The production build and
`git diff --check` pass. These checks do not replace visual acceptance.

The normal authenticated `/field-draw/` UI was opened using its explicit Demo;
manual tear at 90% triggered extraction and a deliberate flip completed. Captured
intermediate frames cover extraction, withdrawal, clearance, turn and landing at
1172×854, with clearance/turn checks at 1024×768 and 390×844. Card rotation starts
with a visible gap above the pouch. Browser viewport overrides were reset, and
the normal picker remains open for user review. No draw API/business writes or
new saved results were made in this review. No push, PR or release occurred.

### Production configuration and hosted login, 2026-11-22

Dedicated operator credentials and a pooled `field_draw_app` connection are now
production-only Vercel secrets. The role has CRUD/sequence access to `field_draw`,
without schema CREATE or access to the existing public roster tables. No database
owner credential is supplied to this room. The merged migration was validated on
a temporary branch of the actual production database, then applied after explicit
operator approval. That temporary branch was deleted. Existing public roster and
winner counts stayed at one and ten; field business tables started empty.

Production login exposed a platform contract missing from the standalone HTTP
checks: Vercel supplies a parsed `req.body` and edge client address instead of
requiring a native request stream/socket. `server/request-json.mjs` now handles
both delivery shapes with the same JSON/UTF-8 size limits; roster mutations reuse
it. Vercel rate limits use its overwritten `x-forwarded-for` header; standalone
Node uses only the socket peer and ignores forwarding headers. Missing addresses
fail visibly instead of sharing an unknown-client limit bucket. No credential,
authorization or persistence fallback is introduced.

See Vercel's official Node runtime request-body documentation and request-header
contract: https://vercel.com/docs/functions/runtimes/node-js and
https://vercel.com/docs/headers/request-headers . Regression coverage includes
`tests/field-draw/request-runtime.test.mjs` and the PostgreSQL/HTTP suite in native
mode and with `FIELD_DRAW_TEST_HOSTED=1`. Hosted fixtures use the parsed-body/no-
socket request contract; they are backend regression tests, never a product preview.
