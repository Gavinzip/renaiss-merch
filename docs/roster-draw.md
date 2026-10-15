# Renaiss roster draws

The password-protected Surf draw room includes Charizard and Other draws. They
share one roster and one durable winner ledger. Surf VRF state is separate.

## Operator flow

1. Sign into the draw room, then open **名單管理** (`#draw/roster`).
2. Upload UTF-8 CSV/TSV (`name`, optional `id`) or TXT (one name per line).
   [Template](roster-template.csv). Preview and confirm before saving.
3. Each row is one entry. Repeated names with different IDs are separate entries.
   Duplicate IDs, malformed CSV, empty names, control characters and oversized
   files are rejected. Maximum 10,000 entries and 1 MB uploaded file.
4. Return to **噴火龍抽獎** (`#draw/charizard`) or **額外加碼** (`#draw/other`).
   Each draw page shows only a green **已上傳** indicator (or its unavailable/error state), with a
   **重新讀取** control. These pages do not contain file-upload controls.
   The status row has no divider lines; both draw pages place **Demo 預覽** at
   the right of the same row, beside **重新讀取**.
   Refreshing the page retains the chosen draw type and fetches the server's
   current shared roster using `cache: no-store`; an unavailable server is shown
   as a read error, never as an empty roster. The management page uses the same
   draw-room login and existing API, with no independent copy of the roster.
   Charizard: the draggable gift-box preview and Demo remain visible without an
   uploaded roster. Only the live draw requires an uploaded roster with entries
   remaining. **Reveal** enters the already prepared stage, then draws one winner.
   Its entry button uses the original 30th-anniversary 1.45-second page/button
   zoom and 320 ms scene dissolve. The real prepared frame gates the transition;
   reduced motion uses a short fade. Entry alone never draws a winner.
   額外加碼: choose/rotate a Renaiss pack, drag the top seal
   from left to right to tear it open, and tap
   the single card to reveal the winner.
   New draws use **額外加碼** as the saved prize label; there is no prize-name field.
   The card packs remain visible with no roster or no
   remaining entries. The Reveal action is disabled until a roster is available; Demo still allows
   browsing, rotation and opening without touching the roster. Demo playback remains separate from the real roster.
5. A winner is saved **before** playback. The entry is excluded from both draw
   kinds. Refreshing or closing playback never undoes the result. Use the history
   to replay without another draw, or export the complete results as CSV.

The roster may be replaced before the first draw. Once drawing starts it is
locked. **清空目前名單** on the management page asks for confirmation, archives
the active roster, and enables a new upload. It retains all winner rows on the
server. Each draw page lists saved winners of its prize kind, including archived
rounds, and supports replay/CSV export. Exclusions restart with each new roster;
old history never consumes entries in the new round.
The **預覽動畫 · 示範資料** control uses a clearly marked synthetic winner and
never calls the draw endpoint, changes the roster or adds winner history.

## Authority and persistence

`server/roster-draw/routes.mjs` handles `/api/draw-room/roster`, `/upload`, `/draw`,
and `/clear`.
Every route requires the existing dedicated draw-room session. Mutations also
check same-origin. They do not require chain signers or make chain requests.

`server/roster-draw/store.mjs` uses the existing persistent SQLite volume. A write
transaction chooses a remaining entry with Node `crypto.randomInt`, inserts the
winner, and enforces `UNIQUE(roster_id,entry_id)`. Request UUIDs provide
idempotency. Roster ID and expected result count reject stale simultaneous draws.
This is a server-random draw, not VRF and not a publicly verifiable chain draw.

Clearing uses an immediate transaction with the roster ID and expected winner
count. It rejects a stale tab if another operator uploads or draws first. A lost
clear response can be retried while no new roster exists; the same request can
never clear a newer roster. `roster_draw_archives` retains each cleared roster
and the clearing operator/time alongside the unchanged winner ledger.

## Presentation reuse

The `charizard/` scene is ported from the user's `30th ann/src/draw/bonus-prize`
project: same product mesh, packaging, 14.5 second timeline, atmosphere, lighting,
postprocessing and score. Only event-specific winner labels and integration are
adapted. It receives an already persisted winner; it does not choose one.

The Other scene uses the existing Surf Pro foil mesh, carousel, tear path,
card flight and DOM flip. `renaissDrawArtwork.ts` supplies a separate Renaiss-only
foil/card skin. Existing Surf artwork remains the default.

Both packs use a manual tear: a click does not open it. The torn edge follows
the drag and stays in place when released. Finish dragging to the right edge
to reveal the cards. The focused seal also supports Arrow Right / End keys.
The ceremony has a bounded height independent of batch size; all 20 membership
cards remain available in the scrollable result gallery.

`media/roster-draw-asset-release.json` describes the versioned Cloudflare media.
Source material stays in `work/roster-draw-media`, outside public and dist.
Production uses the configured static CDN base; unpublished assets fail visibly.
The model, artwork, score and decoder load directly from R2. No media proxy.

### Single-card print and foil continuity

The Other reward remains a **landscape** card, packed sideways and turned to
reading orientation after extraction. This orientation is intentional.
`RenaissRewardCard` lays out one complete face without a miniature card inside.
`renaissRewardSurface.ts` supplies the same procedural substrate to the DOM and
`paintRenaissReward.ts`; the moving print measures the real branded-back typography.
The reverse is a full-face Renaiss design with a centred wordmark and a clean
light substrate, without wave or engraved-line patterns. Neither roster ceremony (Other or Charizard), the winner face, nor
the public result history displays a ticket number. Only chain draws have
ticket numbers. Roster entry IDs stay internal to upload management, persistence,
exclusion and CSV reconciliation; a demo ID is never printed on the card.
The flight shadow hands off to the DOM faces at landing, so it follows the
card through a flip instead of leaving a fixed card-shaped outline. Full-bleed
print faces meet a thin matte sidewall with the same measured corner radius;
the extra metallic bevel and printed double frame are removed.

`card-foil/` adds input-driven WebGPU spot foil to the wordmark. One shader
light is clipped through the official logo alpha and composited into both the
DOM overlay and the moving card texture. A finite sweep follows extraction and
the click flip; pointer position controls the reflection while hovering. There
is no idle animation or wave pattern. Hidden/offscreen cards pause, reduced
motion keeps a static print, and GPU failure is reported by the ceremony.

After clearing the sleeve, cards rotate to landscape in 0.32 seconds and deal
0.05 seconds later. The roster page shows upload state directly; explanatory
empty-state prose is omitted and result history appears once results exist.

`proBoosterGeometry.ts` owns the tear seam position and publishes that location
to the manual drag handle. The released seal bends locally and falls out of view.
The foil/card stack share a centred cavity depth, including the twenty-card case.
During withdrawal the render surface extends to the viewport edge without
changing the gallery layout, avoiding a cut-off at the stage's lower boundary.

## Shared draw-room layout

`DrawRoom/DrawRoomHeading.tsx` and `DrawRoomLayout.css` own the common heading,
status scale and viewport composition for Surf, Charizard and Other. Charizard
uses the same centred prize / bottom actions arrangement. Charizard and Other
share a borderless roster status row, with refresh and Demo aligned on the right.

`useDrawViewportStage` measures the stage's actual document position and reserves
24px below it, rather than stacking a fixed 85vh scene below the page header.
Resizing and header wrapping remeasure the available height. Very short windows
retain a 300px usable stage and normal page scrolling. The existing Surf theater
continues to own its fullscreen ceremony layout. Pack geometry uses the gallery's
measured bottom inset, so internal controls do not overlap the foil or cards.

## Prepared scenes and pack wheel

The authenticated draw-room session owns one shared roster controller and one
artwork provider. Charizard and Other panels remain mounted across route changes;
inactive panels are inert and their rendering is paused. Charizard prepares its
preview, cinematic frame and decoded score before enabling Reveal. Its closed
dialog has fixed viewport dimensions so it can warm GPU targets without adding
page height. Re-entering resets the timeline and score, not the renderer.
Preparation failures remain visible on the draw page.

Other and the Surf Pro Membership pack picker use the same **Reveal** control and
carousel. It starts a finite two-second, easing-out
orbit of all seven packs. After it stops the operator can spin again, continuously
drag the wheel, or choose a pack and manually tear its seam. A wheel position is
presentation only; it does not select a winner. In Other, finishing the tear
requests the server draw and only the saved result proceeds into the reveal.
Surf Pro Membership receives its confirmed batch before the pack picker opens;
spinning or choosing a pack never changes those results. Replays use the
saved/synthetic result and never call the draw endpoint. New rounds reset the
existing renderer by revision, avoiding repeated shader/model preparation.

The production service's `/healthz` reports the SQLite path
`/data/merch-shipping-claims.sqlite`. Read-only verification on 2026-10-15 confirmed
`/data` is an actual ext4 mounted volume. Roster and winner tables share this
existing database; no independent browser/localStorage result store is used.

An uncertain request stays bound to its original prize and request UUID. Other
prize kinds and roster replacement remain blocked until it is reconciled; retry
is still available when a refresh shows the last entry was already saved.
Navigation is locked per active ceremony, including hash/back navigation, until
its winner has been shown. Inactive scenes cannot release another scene's lock.
A Charizard rendering failure stops audio/playback, keeps any saved winner, and
leaves close/reload available, including failure during a pending draw request.
