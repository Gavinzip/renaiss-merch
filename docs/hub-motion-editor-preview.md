# Hub motion and editor preview

Local preview: `/v1.2/?preview=hub#portal-top`. This change has not been pushed or deployed.

## Behavior

- Campaign navigation keeps the outgoing page mounted until its exit animations finish. The next page enters by individual visible elements, with directional movement, staggered timing, and a soft blur. Browser Back/Forward, focus restoration, scroll restoration, rapid reversals, and reduced motion share one route coordinator.
- The top-right navigation uses the existing Renaiss mark, a restrained rainbow edge, and three real destinations. Its items enter separately and the trigger changes with the open state.
- Browsing and customizing consume the same ordered widget list, column footprints, and density. The default is three cards above two cards. Edit controls float over the existing cards; opening customization does not insert a collection into the page or change its grid.
- Only Add widget opens the preset collection with categories and real previews. Removing a widget leaves the draft visible, and removed presets can be added back through the collection.
- Density and column footprints are validated and persisted with preferences. Saved custom layouts retain their actual order, size, and hidden cards. Explicitly selecting a new size releases only that card's preset footprint.
- The AI launch button is hidden while editing to keep the editing rail clear on mobile.

## Cause of the previous layout mismatch

The preset grid was gated by `overview && !editing`. Entering edit therefore switched the page to another layout and density. Saving changes also lost the preset footprints. `hubLayout.ts` now materializes the visible layout before creating the draft; shared preference validation preserves that geometry.

## Verification

- Desktop 1440 x 900: every card's frame has identical x/y/width/height before and after entering customization. Column spans are 4/4/4 then 5/7.
- Reorder, save, reload, cancel, hide, and re-add through the preset preview were checked in the guest browser. Account preferences were not changed.
- Mobile 390 x 844 and English 320 x 800: navigation stays within the viewport and there is no horizontal overflow. Edit controls and collection were checked.
- Rapid browser Back/Forward/Back settles on the final requested route and restores the campaign entry focus.
- Native browser reduced-motion emulation: dashboard and campaign have no running animations; campaign heading opacity is 1 and transform is none. The temporary emulation was reset afterward.
- Shared preference assertions, TypeScript, `git diff --check`, and the production build passed. No persistent test files were added.
- Hub remains a development preview. The production Store build excludes this preview; this is not a production Hub release or an end-to-end account verification result.

Review screenshots are in `work/reviews/hub-motion-editor-2026-10-07/`.

## Earlier October 7 depth experiment (superseded below)

- Removed the redundant Your Renaiss headline and introduction; the logo and compact design-preview label remain.
- Every widget and preset preview shares `HubWidgetDepth`: a physical bottom edge, layered contact/cast shadows, iridescent rim, pointer tilt, tracked light, and an eased return. The flat wrapper owns pointer input. The inner material owns tilt or edit-mode jiggle; the route surface and grid frame keep their separate motion owners.
- Increased first-load and campaign movement, blur, scale and stagger. Touch keeps native scrolling; reduced motion flattens the material immediately.
- Event widgets now use `HubEventHero`, showing real Community Hub images and titles with synchronized source links, pagination and playback controls. Image bytes are decoded before automatic advancement. Missing/failed source images remain visibly identified; no generated imagery substitutes for source content.
- Autoplay pauses while offscreen, on a hidden document, on hover, on keyboard focus, in editing/preset preview, and under reduced motion. Manual switching remains available.
- Desktop 1440 x 900: all five widget frame rectangles match exactly before/after editing. Desktop 1280 x 800: the footer ends at y=693 and all five cards fit without horizontal overflow. Mobile 390px and English 320px: no horizontal overflow; controls remain operable and native touch scrolling is preserved.
- Native reduced-motion emulation returned `reduced:true`, `playing:false`, and material `transform:none`; the temporary emulation and test tab were removed afterward.
- Current review screenshots: `work/reviews/hub-depth-2026-10-07/`. These remain local review changes, with no Git push or deployment.

## Current October 7 thin-glass revision

- The bottom-edge experiment used hard offset shadows to suggest physical thickness. Pointer tracking rotated and lifted the whole material, competing with reading. Both treatments were removed after visual feedback.
- `HubWidgetDepth` is now a static wrapper shared by the dashboard and preset preview. It has no pointer listeners, RAF, tracked glare, perspective, hover lift, or focus lift. Cards use translucent white glass, a fine white border and 28px backdrop blur. The later light-and-shadow refinement below restores depth without a solid bottom edge.
- Dashboard entry and return use an 8px rise and 3px blur without scaling. Edit-only jiggle remains restrained and separate from browsing; event image/title playback and controls remain available.
- Desktop 1440 x 900: all five materials report `transform:none` before and after pointer input; no tilt hooks remain. The original three-above-two layout remains. Mobile 390 x 844: document width is 390px with no horizontal overflow.
- TypeScript, production build/asset audit and `git diff --check` pass. No permanent test files were created. Review images are retained in `work/reviews/hub-glass-2026-10-07/`; nothing has been pushed or deployed.

## Current glass light-and-shadow refinement

- The first thin-glass revision reduced the shadow too much, visually flattening the cards. Added diffuse contact and cast shadows at different distances, brighter top/left edges, and subtle surface light falloff to suggest a glass plane separated from the background.
- Borders remain 1px; exterior shadows all have positive blur. No solid extrusion, duplicated card layer, pointer movement, hover rotation or lift was added.
- Desktop 1280 x 720 and the user's existing 1440 x 900 editor were visually checked. All five cards retain their grid; the independent review has no horizontal overflow. All materials report `transform:none` outside editing.
- The user's open customization draft was preserved. A temporary independent review tab was closed after capture; viewport overrides were reset. Build/asset audit and `git diff --check` pass. Review image: `work/reviews/hub-raised-glass-2026-10-07/desktop-overview.jpg`. No push or deployment.

## Merch hero control removal and carousel initialization repair

- Removed the visible Merch hero pause/play button, its state and unused CSS. The sealed-box loop still respects offscreen, document visibility and reduced-motion settings.
- Browser verification exposed a separate initialization race: event images could decode before asynchronously imported CSS defined the autoplay duration, causing an effect to throw and clear the page. The six-second interval now has one runtime constant rather than depending on stylesheet readiness. No substitute timing or visual fallback was added.
- Cold reload presents the five widgets normally. Merch is ready with no pause button; the event carousel initializes and reports active playback without the missing-duration exception. TypeScript/build asset audit and `git diff --check` pass. Review image: `work/reviews/hub-hero-control-2026-10-07/merch-card.jpg`. No push or deployment.
