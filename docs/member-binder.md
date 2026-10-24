# Member Binder

Open **My Binder / 我的收藏冊** from the existing Community or Merch sidebar.
The normal application route is `/#binder`; refreshing or returning from SSO
preserves that destination.

The binder uses the verified Renaiss session and its Safe wallet. Its library
contains held SBT badge IDs, with names and images from the official Renaiss
achievement catalog. It does not present token balances as badge counts or
invent prices for soulbound badges. This version supports SBT badges.

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

`BinderBook` sizes the book from the actual available stage, including Safari
chrome and safe-area padding. Below 760 CSS pixels, initial entry and a
wide-to-narrow transition close the cover. Returning to a wide viewport restores
the last spread. A wide, short viewport gets adapted page proportions so the
open book fits the Duo display. This responds to the browser viewport, not a
hardware hinge-angle API. Page navigation remains available while folded.

`BinderTitle` retains the original static-text behavior when WebGL is unavailable;
the binder and persistence are unaffected. Reduced-motion preferences suppress
the animated title, idle movement and page-turn animation.

## Persistence and authentication

- `GET /api/binder`: the authenticated account's saved configuration and revision.
- `GET /api/binder/library`: verified holdings and official badge metadata.
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

From the same normal binder route, **Try with sample badges / 用示範徽章試玩**
opens a clearly marked practice collection. A shareable entry is
`/?binderPractice=1#binder`. It requires no login and uses the same
`BinderWorkspace`, book, picker and detail animation as an account collection.
Eight official sample badges start in the first sheet, with two available to
insert. Practice changes live only while this view is mounted and can be reset.
There is no sample session, ownership grant, eligibility bypass or database write.
Returning to the account collection restores its own loaded/draft state.

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
