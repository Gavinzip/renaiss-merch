# Member Binder

Open **My Binder / 我的收藏冊** from the existing Community or Merch sidebar.
The normal application route is `/#binder`; refreshing or returning from SSO
preserves that destination.

The binder uses the verified Renaiss session and its Safe wallet. Its library
contains held SBT badge IDs plus general trading cards. Cards come from the same
user-scoped `collectible.list` query used by the Renaiss binder. The verified OIDC
subject supplies `userId`; each card's owner must match the verified Safe or legacy
wallet. The library includes card names, sets, grades and image references.
It does not invent prices. Badge metadata still comes from the official catalog.

Choose a pocket to add, replace, or remove a badge. Each badge may appear once.
Each page supports 1, 6, or 9 pockets, with up to 24 pages. Smaller screens show
one page; larger screens show book spreads. Save explicitly to persist the
configuration to the Merch account. These are Merch binder configurations,
stored independently of the binder on renaiss.xyz.

## Reference presentation and folding layout

The presentation follows the live `https://www.renaiss.xyz/binder` inspected on
2026-10-24: dark cover, frosted pocket sheets, center rings,
Poppins / JetBrains Mono typography, profile cover, right-hand badge drawer,
and page navigation. Leaves remain mounted as front/back faces and turn about
the central spine using the reference's 860 ms cosine easing, curved clipping,
and shading. The surrounding canvas is the shared pink background; page materials
remain dark. The distorted background name retains the reference motion values.

General cards use the reference's normalized square-render crop (left 0.27,
top 0.07, width 0.462, height 0.81), preserving the slab and stand in pockets,
the picker, cover thumbnails and inspection view. Pocket art occupies 81.2% of
the pocket height at a 6.8% top inset. The same crop is applied to the explicit
practice card photos; the photos themselves remain unchanged CDN assets.
Insertion uses the reference's 500 ms drop, 750 ms shine and five sparks, retained
for 900 ms independently per pocket. Removal lifts for 300 ms before changing
the pocket; Save and conflicting slot edits wait for that lift to finish.
Inspection preserves the 850 ms rotation in and 420 ms rotation/fade out.

`BinderBook` sizes the book from the actual available stage, including Safari
chrome and safe-area padding. Below 760 CSS pixels, initial entry and a
wide-to-narrow transition close the cover. Returning to a wide viewport restores
the last spread. A wide, short viewport gets adapted page proportions so the
open book fits the Duo display. This responds to the browser viewport, not a
hardware hinge-angle API. Page navigation remains available while folded.
The narrow closed-cover position changes without a second horizontal centering
transition. Turn initialization follows the committed spread update, so React
cannot remove the imperative turn class and let the idle cover animation take
over mid-close. A wide-to-narrow display handoff settles the cover and all leaves
in the same commit, without replaying a turn from the now-clipped left side.
This also cancels an interrupted turn; book, leaf and shade transitions are
suppressed only while resolving that handoff pose. Manual closing/page turns
and wide-display restoration retain the reference animation and idle motion.
Page-count navigation is queued after the current React commit.

`BinderTitle` retains the original static-text behavior when WebGL is unavailable;
the binder and persistence are unaffected. Reduced-motion preferences suppress
the animated title, idle movement and page-turn animation.

## Persistence and authentication

- `GET /api/binder`: the authenticated account's saved configuration and revision.
- `GET /api/binder/library`: verified card and badge holdings and metadata.
- `GET /api/binder/card-media?tokenId=…`: recheck card ownership, request a
  Cloudflare R2 ingest using only control-plane metadata, then issue a short-lived
  signed Cloudflare URL. Image bodies never pass through the application.
  Image batches reuse a verified user-and-wallet-scoped ownership snapshot for
  at most 30 seconds; explicit library refresh and Save always query afresh.
  A full paginated inventory query has a total 20-second deadline.
- `PUT /api/binder`: same-origin, authenticated write with ownership and revision
  validation. Stale revisions return 409; invalid or unowned references are rejected.
- No browser wallet input, Demo identity, or local-storage document substitutes
  for the session and PostgreSQL storage.

The `member_binders` table is registered in `server/postgres/schema.sql`, so
the existing PostgreSQL snapshot exporter includes binder configurations.
Apply the additive migration with the intended environment configured:

```sh
node scripts/migrate-member-binder.mjs
```

As with the Surf migration, the application role must receive only the table
permissions it needs. If it cannot run schema changes, provide an administrative
connection using `MERCH_MIGRATION_DATABASE_URL_FILE`; the script verifies that
the administrative and application connections target the same database.

## Local review and release

Use the normal `npm run dev` entry with the documented Node 22 runtime, existing
SSO credentials, `MERCH_STOREFRONT_MODE=production`, a matching local callback,
and an isolated PostgreSQL branch. No production schema changes are needed for
local review.

The three fonts and the Renaiss wordmark are versioned R2 assets recorded in
`media/member-binder-asset-release.json`; their source and OFL licenses are kept
under `src/assets/binder/` and are not bundled as media in `dist`.
All 315 public badge images in the inspected official catalog are mirrored to
versioned Cloudflare R2/CDN AVIFs in `media/member-binder-badges-release.json`.
Run `node scripts/prepare-binder-badges.mjs` to prepare an updated catalog, then
publish it with `scripts/r2-merch-assets.mjs publish --catalog` and verify live
hashes, content types, CORS and immutable caching before release. Source PNGs
and encoded working files stay in the ignored `work/member-binder-release/`.
An owned badge missing from the published manifest fails visibly; it does not
switch to a different origin or an application-server media proxy.


## Explicit practice mode

From the same normal binder route, **Try with sample cards / 用模擬卡片試玩**
opens a clearly marked practice collection. A shareable entry is
`/?binderPractice=1#binder`. It requires no login and uses the same
`BinderWorkspace`, book, picker and detail animation as an account collection.
Practice defaults to 18 portrait trading-card samples with a 63:88
aspect ratio. Seventeen start across three sheets (nine and six pocket layouts),
with one available to insert. Three public reference card images from the same
Renaiss collectible catalog are versioned AVIFs on public Cloudflare R2, recorded
in `media/member-binder-card-samples-release.json`. Source JPGs stay in the ignored
`work/member-binder-release/cards/`. The readout and inspection view identify
these as simulated cards, not a token, price, ownership record or image fallback.
Cards retain the shared pocket, inspection, replacement and turn animations.
The tools panel switches between **Trading cards / 一般卡片** and the existing
official SBT samples; switching resets the transient practice collection.
`binderSamples=cards` or `binderSamples=badges` selects the practice dataset.
The badge dataset still starts with eight placed and two available.
Practice changes live only while this view is mounted and can be reset.
There is no sample session, ownership grant, eligibility bypass or database write.
Returning to the account collection restores its own loaded/draft state.
Authenticated storage keeps existing numeric badge references and adds
`card:<uint256>` references without changing the JSON version or database schema.
Save rechecks both holdings sources and rejects every unowned reference. Practice
cards have no real token reference and are never written through this endpoint.
The Cloudflare worker ingests only images under the fixed official Renaiss Blob
origin and `/graded-cards-renders/` path, validates type/size/ETag, and stores the
body in private R2 before serving it. Source ETags version the R2 object key.
Preparation accepts the server bearer token only; public signed URLs cannot
ingest content. Existing signed GET/HEAD and MP4 range delivery are unchanged.

Safari's ready binder viewport uses `viewport-fit=cover`, with safe-area insets
applied once by the canvas. Native Safari control areas sample the shared pink
background; Safari 27.1 cannot place actual web content behind those controls.
The original Hub viewport is restored on exit.
Compact wide screens fill the available width and height with a two-page spread;
artwork retains its own aspect ratio. Folded widths start with the cover closed.

## Cover motion and writing

The front cover retains the original idle micro-opening, hover peek and tilt.
There is no elastic closure. Opening and dragging page edges use the original
page-turn motion directly. Reduced motion suppresses the decorative motion.

Inside the binder, **Write / 書寫** enables freehand pen, positioned multiline
text, eraser, four ink colors, three sizes and up to 40 writing undo steps.
The writing toolbar is a flat sibling of the perspective stage, so book faces
and page-turn hit areas cannot intercept its mouse input.
Writing mode shields pockets and page edges from accidental badge edits/turns;
the pager still works after lifting the finger or finishing text. Ink lives
on each mounted face and turns with that face. Page-relative coordinates follow
Duo resizing; text glyph proportions remain undistorted. The front/back inside
covers are also writable.

The optional `writing` document is validated with the existing binder on both
client and server, uses the same explicit Save action, revision locking and
authenticated PostgreSQL row, and needs no schema migration. Limits: 240 marks,
16,000 total points, 1,600 points per stored stroke segment (a long gesture is
split without losing its trajectory), 240 characters per text mark.
Only the binder PUT accepts up to 512 KiB; shipping requests retain 16 KiB.
No SVG/HTML input is accepted. Practice writing uses the already authorized
practice workspace and remains unsaved, like practice badge changes.
