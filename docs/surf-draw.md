# Surf draw in Renaiss Hub

The draw room is part of the existing Hub at `#draw/surf`. The Surf campaign
does not show a public entry to it; operators use its direct URL. It uses the site's shared Hub header, navigation, account
control and language selector. The draw room requires its separate username
and password before either the page or its read API can be viewed. Signed-in
Renaiss fulfillment administrators additionally see the operator controls and
private ledger status.

## Draw-room access

Set `SURF_DRAW_ACCESS_USERNAME` and `SURF_DRAW_ACCESS_PASSWORD_HASH` as server
secrets. Generate a salted scrypt hash and a local credential file with
`node scripts/create-surf-draw-credential.mjs`. The script stores the plaintext
only in a Git-ignored file under `.secrets/`, and writes the username and hash
to Git-ignored `.env.local` for local development. Set the same two values
independently in the production environment before release; neither the
plaintext password nor hash belongs in Git or frontend assets.

`/api/auth/surf-draw/login` issues a 12-hour HttpOnly, SameSite=Lax session
cookie. Login attempts are limited server-side, logout revokes the session,
and changing the configured credentials invalidates existing sessions. The
draw data APIs reject unauthenticated requests, including direct requests
outside the Hub page. Missing or invalid access configuration fails closed.
The separate password grants entry to the room only; formal draw mutations
still require the existing Renaiss SSO fulfillment-administrator session,
same-origin POST checks, and the on-chain operator checks described below.

The operator selects either prize group before each formal reveal. Both groups
default to their entire remaining batch (up to seven boxes or twenty
memberships); the plus/minus controls can select a smaller batch. The
choice is available even when the other group has unrevealed slots. One
`drawPrizeSlots(drawId, slots)` transaction publishes the selected consecutive
unrevealed slots of that group atomically. Each slot remains bound to its
deterministic on-chain ticket; choosing publication order cannot choose winners.
The server checks the requested group, exact available slot sequence and current
winner count before signing. The UI waits for the confirmed results before
running the box or foil-pack ceremony. No per-prize 0-to-7 receipt counter is
shown. Cards still reveal their winner names only when manually turned.

The development-only local simulation uses separate demo tickets and the same
group and batch controls. It does not call the draw API or sign a transaction;
it can start with either full prize group and can restart either group at any point.
Closing it discards its local results. Existing on-chain results appear directly
on first load. Reduced-motion handling stays with the existing ceremony scene.

## Page choreography

`useSurfDrawTheater` moves the original DOM into a full-viewport layout. It
measures the actual shared header (including wrapped mobile controls), reserves
the stage's place in document flow, locks document scrolling, and uses FLIP
transforms for the prize, captions and ticket. Scaling stays uniform to preserve
artwork and letterforms. Single mode has no duplicated ticket or remounted reel.
Batch mode uses a separate Three.js ceremony canvas, described below.
The surrounding masthead/results/proof/footer retire and become inert while the
stage is active. The existing shared header and exit control remain available.

`SurfDrawCinema` owns one stable WebGPU canvas through
`draw-effects/surfDrawAtmosphere.ts`. It uses the installed `shaders@4.0.0`
core renderer and the actual built-in Aurora component. `surfAtmosphereField.ts`
owns its palette and phase props; `surfAtmosphereShaders.ts` contains only the
original WGSL stage substrate and a directional exposure. No paid preset or
copied website section is used. The MIT
notice remains in `docs/licenses/shaders-MIT.txt`. The core renderer imports no
telemetry collector; the canvas explicitly records telemetry disabled.

The rejected chromatic arcs, radial rainbow wave and line mesh are removed.
The environment uses three layered Aurora curtains, with ice blue, teal
and rose transmission over pearl white. The library's own animated clock drives the
whole field. Charge raises the curtain's motion, height and brightness; each
real stop slows the clock and gathers the wave structure. The one-second ticket
pause is still. The real box opening / credential flip releases and lifts the
curtains, with one directional exposure and a 3.6-second bounded tail. Batch
release starts with the source opening; single release starts with the name.
Existing results never replay the release. The original silver ticket and
approved prize art remain DOM above the environment. The same shared header
retains its original transparent surface, padding, border and opacity. Outside a draw, the original page
background is unchanged.

`surfAtmosphereChoreography.ts` owns the presentation envelope. Shader motion
is not inferred from the host RAF counter: review captures at different moments
must show visible movement in the background itself.

Rest states stop both the shader renderer and the host RAF. Hidden documents
and offscreen canvases pause. Reduced motion paints a still environment without
light travel or a reveal sweep. Resize caps backing resolution at 1.8 million
pixels and DPR 1.5. Renderer resources, timers, observers and listeners are
cleaned up on unmount, including during asynchronous initialization.

Admission checks the actual WebGPU adapter/device using `getWebGPUSupport`,
then compiles, presents and waits for the submitted GPU queue in charge,
anticipation, peak and rest states. Lazy module loading and first-frame
preparation each have a 15-second deadline. Missing WebGPU, shader/device loss
or preparation failure visibly blocks the draw and offers a Reload action.
The WebGPU atmosphere has no WebGL, CSS or bitmap fallback. The independent
Three.js batch ceremony deliberately uses WebGL for its solid geometry; it is
not a replacement renderer for the atmosphere. Media retain their independent
real download/decode/paint admission. Graphics stay dynamically imported.

During the 4.5-second minimum hold, the box pushes forward once and the ticket
moves from an angled pose toward the viewer. Each real reel stop straightens the
ticket a little further. The completed number holds for one second; the box then
opens or the membership flips as the display name arrives. In single mode,
the final winner holds for 1.6 seconds, then returns to the original page over
900ms. Batch mode stays in its readable gallery until `Back to draw page` or
another explicit action. Scroll and inert states
are restored on exit or unmount. Reduced motion retains the readable composition
and timing without camera, layout or exposure animation.

Prize tabs select both the result list and the reveal scene. Mystery Boxes use
transparent frames derived from the approved opening film; memberships use the Store's shared silver
`SurfProCredential` with its localized one-month label. The ticket shows only
the selected group's latest winner, or its waiting state when that group has
no results. Starting a draw synchronizes the scene to the actual next slot and
locks prize tabs until the batch finishes; browsing never changes prize order.

The development-only simulation has separate `Preview Mystery Boxes` and
`Preview Memberships` actions. Each remounts only local simulation state with
the full selected group by default; the operator can then choose either group
and reduce the batch size. Decoded media stays in the page provider. Preview is
disabled during a draw/batch, and never calls a reset,
ledger, signing or chain API. It lets local reviewers return from memberships to
the box animation without consuming a real prize or refreshing the whole site.

## Prize animation

The draw no longer embeds the film's pastel backdrop or uses an oval mask to
hide it. `scripts/prepare-surf-draw-motion.py` separates the connected box from
the background, preserves enclosed lettering and coin logos, removes edge
colour spill, and packs 65 original frames into five transparent WebP atlases.
The lid's upper contour preserves its convex metal surface through broad
specular highlights; it must not cut a notch into the opening lid. The current
atlases total about 4.0 MB in transfer and 103.4 MiB after bitmap decoding.
Segmentation uses the original 1080p pixels. A subpixel alpha contour and
premultiplied resampling preserve clean metal edges without pastel fringes.
The atlases discard shared transparent padding, reducing decoded memory by
29% compared with full 768px square cells, without reducing pixel detail.
The original film remains unchanged. Near-stationary lead frames are sampled
and the stationary tail is omitted; the opening plays once over 1.6 seconds.
Every frame shares one scale and ground plane, with the source camera pan
compensated. Canvas retains the final open frame and stops requesting frames.
No video decoder, reverse movie, film poster, background mask or blank-media
fallback is used in the draw room.

`SurfDrawMotionAssets` owns decoded box atlases and official card logos for
the lifetime of the page. Switching into local simulation reuses them without
a preparation flash. Downloads validate MIME type, exact bytes and decoded
dimensions. Errors block the relevant draw control and expose a retry.
The 768px canvas renders cropped 661×631px atlas cells at their original offsets
inside the prize container's explicit responsive
height, so neither the box nor its mobile variant can cover the prize title.

In single mode, after the ticket's one-second hold, the box opens while the name rises into
view. Pro Membership uses the Store's vector silver credential: both partner
logos on the back, then a 900ms flip and one reflection sweep to the front.
Both prize layers remain mounted; group selection moves the box downward and
the card sideways over 600ms. Idle and final artwork stay still. Reduced
motion paints the box's final frame and shows the card front immediately,
including if the preference changes during a reveal. The one-second ticket
hold remains. `useSurfDrawRevealCompletion` requires both completion signals
before publishing the single visible winner. Batch mode uses
`useSurfBatchFlight` to wait for the real 3D source and all card flights, then the
one-second ticket hold and each card's front-face turn. `SurfDrawBatchScene` owns the
composition, `SurfBatchPrizeThumb` paints the approved final atlas frame once at
240px using the page's shared decoded bitmaps, and `useSurfDrawBatch` owns only
the sequential receipt range. No new media download or generated artwork is
introduced. Mobile uses two columns and a native scrolling gallery; intrinsic
grid row heights prevent cards from overlapping in short viewports.

The earlier local review on 2026-10-12 covered seven sequential boxes stopping
at the prize boundary, then two memberships. The page-wide ceremony was then
checked at the normal app viewport, a 696px panel and 390px mobile widths,
including a 667px-tall phone. Sequential stops remain about 190ms apart, with the
one-second ticket hold and separate 1.6-second box / 900ms membership completion.
Earlier clean-layout captures are in `work/reviews/surf-draw-ceremony-2026-10-12/`;
the subsequent immersive-light review is in
`work/reviews/surf-draw-immersive-2026-10-12/`.
That review covered seven boxes stopping at 7/7 with memberships still 0/20,
then separate membership draws at 390×667 and 1218×853. The mobile ticket,
prize and exit control stayed inside the viewport with no horizontal overflow.
The GPU frame counter stayed unchanged after the release tail; scroll unlocked
and ordinary page sections became available again. The actual field energy
decreased with the six stop callbacks, with the one-second ticket pause retained.
The subsequent slower-light and box-replay review is saved in
`work/reviews/surf-draw-light-polish-2026-10-12/`.
Visual acceptance remains with the user; this is a local preview, not a release.

### Draw motion release gate

The derived atlases load from `work/derived-media/` in development. The five
content-hashed WebP atlases listed in `draw-effects/surf-box-motion.json` and
the 3D box UV texture are published together as the public release in
`media/surf-draw-motion-release.json`.
Set `VITE_SURF_DRAW_MOTION_CDN_BASE_URL` to that versioned HTTPS directory
for production builds. Missing CDN
configuration fails visibly. Do not bundle `work/`, the original film, the RGB
intermediate or matte review into public/dist, and do not weaken the private
Merch reveal route. Verify CDN bytes, MIME, immutable cache and load timing
before release. The release recorded above is the versioned production source.

## Rules and contract

- The persisted `mission_participants` table is the only ticket source. A
  verified account task grants one ticket; verified X and Discord tasks grant
  one each. Each person can have one to three tickets.
- There are 27 main prize slots: slots 0–6 are Surf Mystery Boxes and slots
  7–26 are Surf Pro one-month memberships; reveal order is operator-selected.
  There are no reserve selections. The on-chain draw
  chooses distinct ticket numbers, so a ticket can win once and one person can
  win multiple slots only with different tickets.
- The existing BSC mainnet `RenaissLuckyDraw` at
  `0x78b79dB5726700BeDb18BC05aA612b11E33B00A9` is used with draw ID
  `keccak256("RENAISS_SURF_V1_MAIN_ROUND_1")`. The runtime hash, chain ID,
  VRF subscription, consumer registration and signer admin permission are
  checked against the live chain. This is the same deployed source address
  used by the Pokémon 30th draw. Its separate Pokémon 30th rounds adapter has
  fixed ticket and slot counts and is not used for Surf.

## Private ledger and operator sequence

The draw tables live in the existing SQLite database. `surf_draw_snapshots`
stores an immutable canonical JSON ledger and its keccak256 hash. Every
eligible participant gets a contiguous, deterministic ticket range ordered by
SSO subject. The snapshot includes identities for private prize fulfillment;
it is never sent by the public API or bundled into frontend assets.
An eligible participant can lack an email in their Renaiss record; their
verified tickets remain in the ledger, and fulfillment must use the private
SSO subject or wallet to contact them if they win. Present emails are still
checked for duplicates.
`surf_draw_transactions` records the signed raw transaction and hash before
broadcast, preventing a second signature for the same action after an uncertain
response. `surf_draw_action_locks` reserves the round before asynchronous gas
and nonce preflight; a second operator cannot sign concurrently. A process
crash before signing leaves a visible reservation. After two minutes, the
next action may atomically replace it; the old owner's lock ID is checked
before its signed transaction can be stored or broadcast, and the new owner
rechecks the chain before signing. If a process stops after storing the signed
raw transaction but before broadcast, status reconciliation rebroadcasts those
exact same bytes and hash. An uncertain broadcast may be retried every thirty
seconds using those same bytes; it never signs a replacement. A failed receipt
blocks the round for investigation.

1. Wait for the actual campaign close and review the participant table.
2. Set `SURF_DRAW_RPC_URL` to a trusted HTTPS BSC RPC. Configure
   `SURF_DRAW_CLOSED_AT` to the approved actual close instant in ISO 8601, and
   set `SURF_DRAW_ENABLED=true` only when formal actions should be possible.
3. Set `SURF_DRAW_OPERATOR_PRIVATE_KEY` in server secrets to an existing
   contract admin with BNB for gas. Never expose it to the browser or commit it.
4. Use the admin page to lock the participant snapshot, finalize that hash and
   ticket/slot counts on-chain, request VRF once, wait for fulfillment, then
   choose Mystery Boxes or Pro Memberships and how many unrevealed slots to
   reveal. One explicit confirmation authorizes one `drawPrizeSlots` transaction.
   The page waits for its confirmed result and displays transaction hashes.

All mutation endpoints require both draw-room access and the existing
fulfillment-administrator session, same-origin POST, enabled flag and elapsed
close instant. With any condition missing, the round remains read-only. The
draw-room endpoint `GET /api/missions/surf/draw` exposes only the contract state, confirmed
winning ticket numbers, each winner's Renaiss display name, and published
snapshot counts/hash. It omits emails, wallets, signer, account IDs, other
participants and private ticket ranges. A display name containing an email or
wallet is not published; missing names are explicitly marked rather than
substituted with private contact details. A signed-in participant sees only
their own locked ticket range, so they can compare it with the public winning
numbers. Their own winning prize is highlighted in the board.

## Release checks

The current contract's unique-ticket selector scans the ticket space. Before
the formal draw, estimate gas with the final ticket count for the actual
`drawNext` calls and verify it stays below the current BSC block limit. Check
the finalized ledger hash/counts, signer admin permission, VRF consumer and
subscription balance. If any check fails, stop and resolve the cause; do not
silently select or replace winners in the website.

This local implementation has not locked a Surf ledger, signed a transaction,
requested randomness, or deployed to production. A build and read-only chain
status do not establish final-draw readiness.

## Optical background review - 2026-10-12

The previous silk/champagne treatment was rejected as inconsistent with the site.
The WebGPU optical iteration was played in the Codex in-app browser at
1218x853 and 390x667; phone overflow was zero. The endpoint RAF counter remained
unchanged after rest. Representative frames remain in
`work/reviews/surf-draw-optical-2026-10-12/`. This is local visual review, not
user acceptance or deployment. GPU adapter identity is privacy-redacted in this
browser; these observations do not establish performance on physical phones.
The production build passed. The optical module is 10.59 kB (4.33 kB gzip),
plus the shared shaders engine at 2,541.71 kB (711.03 kB gzip). The engine was
already used by the Store's material; it is now shared instead of duplicating
the former 535 kB Three atmosphere bundle. Draw-page JS is 49.99 kB (18.13 kB
gzip). This remains a substantial lazy engine download, with explicit load and
admission deadlines; it is not part of the shared header's initial bundle.
The shaders dependency emits a development-only TypeGPU `external-omitted`
warning for `in.uv` during composition; the actual WGSL pass compiles/presents
and the engine disables that warning in production. No warning is suppressed
by application code. Reduced-motion behavior is source-reviewed, not an OS
preference test in this browser.

## Chromatic glass review - 2026-10-12

The silver optical grid was rejected as unattractive and insufficiently colourful.
This subsequently rejected original WGSL material referenced gpu-effect's ThinFilm and Prism
techniques. Its ambient transmission and edge interference carried colour, but the user
rejected its apparent stillness and rainbow rings. It has been replaced by the
actual Aurora shader; captures below remain historical review evidence.

Cold-load WebGPU admission, complete box playback at 1218x853 and 390x667,
zero phone horizontal overflow and no runtime/GPU validation errors were checked. The
existing development-only TypeGPU composition warning is described above.
Representative frames are retained in
`work/reviews/surf-draw-chromatic-2026-10-12/`. Build and asset audit passed.
Local preview only; no push, deploy, ledger change or chain transaction.
User visual acceptance remains pending.

## Aurora field review - 2026-10-12

The chromatic glass was rejected for rainbow rings and apparent stillness.
The first real Strands trial visibly moved, but its crossing line mesh was also
removed during review. That iteration directly used the library's Aurora definition with three
layered curtains and dimmed the active stage. The user then rejected the dark
shift and its added header panel; the pearl revision below supersedes it.
The original Hub background returns after the final reveal.

Cold WebGPU admission and actual playback were checked at 1218x853 and 390x667.
Two charge screenshots 1.2 seconds apart show visible background displacement,
independent of the spinning ticket: a left-edge background sample had mean
absolute channel change 33.42/255, with 75.8% of channels changing by over 10.
This measures movement, not visual acceptance. Seven simulated boxes completed
at 7/7 with memberships at 0/20; a separate membership draw showed the credential
back, front flip and winner name. Phone horizontal overflow remained zero.
The renderer stopped at rest. Physical phones and reduced-motion OS settings
were not tested. Review frames are retained in
`work/reviews/surf-draw-strands-2026-10-12/`, including the earlier discarded
visual trials; no files were deleted.

Build and asset audit passed. The lazy atmosphere module is 6.66 kB (2.95 kB
gzip); the shared shaders engine remains 2,541.71 kB (711.04 kB gzip), a substantial
lazy download. The existing development-only TypeGPU composition warning is
described above. This remains a local preview awaiting the user's visual review;
no push, deployment, ledger change, chain transaction or media upload occurred.

## Pearl Aurora revision - 2026-10-12

The user rejected the abrupt dark stage and the added white header panel.
The stage now stays pearl white throughout charge, stops and reveal. Aurora
uses deeper ice-blue, teal and rose transmission colours so its movement is
visible against the light substrate. The reveal sweep also stays light.
The dark vignette, header background/radius/padding override, header opacity
animation and white stage text have been removed; ticket shadow is softer.

At 1218x853, the header's computed background (transparent), radius (0),
opacity (1), padding (20px 0) and bottom border were identical before and during
the draw. At 390x667 it retained the shared 11.2px 0 padding and transparent,
square, fully opaque treatment. The phone had no horizontal overflow; charge,
box opening and winner-name reveal were played and captured. Two desktop
background captures 1.1 seconds apart had mean absolute channel change 9.91/255
in an unobstructed left-edge sample, confirming visible movement independently
of the reels. Captures remain in
`work/reviews/surf-draw-pearl-aurora-2026-10-12/`.

Build and asset audit passed: the lazy atmosphere module is 6.68 kB (2.96 kB
gzip); the existing shared shaders engine remains 2,541.71 kB (711.04 kB gzip).
Local preview only, pending user visual review. No push, deploy, upload, fallback
or chain action was added, and no review files were deleted.

## Shared light choreography - rejected and rolled back, 2026-10-12

The following records a rejected iteration. Its converging planes, extra focus
envelope and DOM reflections were subsequently removed at the user's request.
`surfStageLight.ts` was removed; the captures below remain as review history.
The current implementation restores the original bright pearl Aurora, with
only modest motion, height and bounded release tuning in its existing field.

The user approved the bright direction and requested more immersion. This
iteration compressed the pearl Aurora's height and moved its curtain base inward as
the six reels stop, then opens with the prize. A separate focus envelope keeps
that spatial movement progressing even while the light energy decelerates.
The substrate adds two broad, soft oblique planes that converge from the edges;
the reveal remains a directional exposure without rings or particle sprites.

`surfStageLight.ts` reflects the same GPU phase sample on the existing silver
ticket and prize contact light through four scoped CSS properties. It performs
no per-frame layout reads or React renders and restores those properties on
cleanup or GPU failure. It is an intentional DOM material treatment, not a
renderer fallback. The real WebGPU first-frame gate still admits every draw.
The draw controller, original reel elements and one-second ticket hold are unchanged.

Cold admission and full box playback were checked in the in-app browser at
1218x853 and 390x667. Desktop charge captures show actual curtain displacement;
stop and opening captures show the continuous contraction and expansion.
The shared header remained transparent with its original border, radius,
padding and opacity while theater mode was active. Phone horizontal overflow
was zero. At rest the host frame counter stayed at 1331 across a one-second
observation; no browser runtime/GPU errors were recorded. Physical phones and
the OS reduced-motion preference were not tested. Review captures are in
`work/reviews/surf-draw-shared-light-2026-10-12/`.

Build, media asset audit and `git diff --check` passed. Draw CSS is 40.05 kB
(8.11 kB gzip), the lazy atmosphere module is 8.28 kB (3.56 kB gzip), and the
existing shared GPU core remains 2,541.71 kB (711.04 kB gzip). Its substantial
lazy download and the development-only composition warning described above
remain. Local review only; user visual acceptance is pending. No push, deploy,
media upload, chain action, fallback or file deletion occurred.

## Batch box and credential flight - rejected, 2026-10-12

The user rejected this atlas-and-DOM-flight iteration. Its captures are retained
as history; the Three.js revision below supersedes its presentation.

This revision restores the previously approved bright Aurora before adding the
requested batch presentation. The rejected convergence and DOM reflection code
is absent. Current pearl refinement captures remain in
`work/reviews/surf-draw-pearl-refinement-2026-10-12/`.

Local browser review covered seven boxes in a 4 + 3 desktop arrangement, a
separate seven-membership batch, all twenty memberships in one batch, and one
single membership after a seven-box batch. The seven boxes stopped at their
group boundary, and memberships required another explicit action. The full
simulation ended at 27 slots. Completed galleries stayed readable until the
reviewer dismissed them; dismissal restored document scrolling and the results
sections. The single run retained its original reel and identity presentation.

At 390 x 667, the gallery uses two columns and native scrolling, including the
last centered seventh card. Review found implicit grid tracks shrinking below
card height; `grid-auto-rows: max-content` now preserves intrinsic card height,
and mobile reserves sufficient space for the controls. Horizontal overflow was
zero. At 1218 x 853, captures 700ms apart during settling showed different real
card transforms from the common source to their final slots; the source's
opening and Aurora release coincided. Twenty-card galleries were checked at
both their first and final rows. No runtime errors were captured after the
fresh page load used for these runs. Physical mobile performance, OS reduced
motion and real chain transactions were not tested.

Captures remain in `work/reviews/surf-draw-batch-flight-2026-10-12/`. Build and
media audit passed: draw JS 58.86 kB (20.79 kB gzip), draw CSS 47.67 kB (9.37 kB
gzip), atmosphere 6.78 kB (2.99 kB gzip). The existing lazy GPU core remains
2,541.71 kB (711.04 kB gzip) and still produces Vite's large-chunk warning.
No media generation, fallback, push, deployment, upload or chain action was
performed. Review captures remain; no test source files were introduced.

## Anniversary reference and Three.js batch ceremony - 2026-10-12

At the user's request, the actual `/Users/gavin/Documents/ChatGPT/30th ann`
project was inspected and its `/draw-demo` was played locally. Reference modules
include `useCardCeremony.js`, `ceremonyTimeline.js`, `cardFlight.js`,
`createCardMesh.js`, `createParticleBloom.js`, `particleBloomShaders.js` and the
hinged-box variation. The reused structure is one finite charge, opening/impact,
dimensional back-face flight, landing and individual front-face turn. No
Pokemon assets, anniversary artwork, models or chain logic were copied.

`draw-effects/batch-ceremony/` separates timeline sampling, solid card geometry,
card artwork, hollow box geometry, the burst shader and renderer lifecycle.
The Surf box has a real pivoting lid, four walls, an interior card stack,
metal trims, hinges, corner fasteners and a clasp. The emitted cards have
bevelled edges and opaque front/back textures. They leave the same 3D source,
follow separate depth lanes and land in the actual result-card bounds. Each
finished flip hides only its own mesh and exposes its DOM front; the batch
does not fade out or re-enter. Pro Membership uses a Surf credential source
and the Store credential on each result. The existing pearl Aurora and shared
Hub header stay in place. The short ice/pearl/rose glint burst is adapted from
the anniversary shader and ends once; it has no persistent rings or idle loop.

The dynamically imported scene compiles and presents its box, cards and burst,
uploads textures and checks the real GL result before enabling a batch. Module
and preparation work has a 15-second deadline. Failure blocks the draw with an
explicit Reload message; no image, DOM or alternate-renderer fallback is added.
RAF stops at rest; hidden/offscreen scenes pause, backing size is capped at
1.8 million pixels and DPR 1.5, and textures, geometry, renderer, observers and
listeners are disposed on exit, including an aborted asynchronous preparation.
Reduced motion skips motion while retaining the one-second ticket hold.

Browser review covered seven boxes at 1218 x 853 and 390 x 667, including the
opening, card emission, one-second ticket backs, staggered 3D turns and settled
results. Desktop retains four above and three below; the phone uses two columns
and a centered seventh card with native scrolling. Phone horizontal overflow
was zero and its final card remained above the controls. A separate 20-card
membership batch completed slots 08--27; both first and final gallery rows were
checked, and the renderer stopped at rest. The batch boundary retained 7/7
boxes and 0/20 memberships until another explicit action.

Review found two presentation issues: the opened lid encroached on the title,
and cached back textures carried previous-batch tickets into the next flight.
The opening now moves downward, flight trajectories reserve heading space,
and each new batch resets gallery scroll and prints clean current-slot backs
before emitting. Actual current tickets are printed only at the ticket phase.
The corrected cross-group flight was replayed. Physical-device performance and
OS reduced-motion toggling were not tested. No real draw or chain action was
performed, and visual acceptance remains with the user.

Captures are retained in
`work/reviews/surf-draw-3d-ceremony-2026-10-12/`, including intermediate review
frames. No generated media, test source files, new dependency, upload, Git push
or deployment is part of this local revision.

The final TypeScript/Vite build and media audit passed. Draw JS is 58.49 kB
(20.56 kB gzip), draw CSS 46.37 kB (9.10 kB gzip), and the lazy Three.js ceremony
is 573.95 kB (149.57 kB gzip). The existing lazy WebGPU core remains 2,541.71 kB
(711.04 kB gzip). Both graphics engines exceed Vite's 500 kB chunk warning;
this remains a local review with no physical-device performance claim.
The final cold-load seven-box/20-membership playback logged no runtime errors,
and returning to the original page restored document scrolling and showed
7/7 boxes, 20/20 memberships and 27/27 total simulated results.

## Charge, impact and full-viewport exposure — 2026-10-14

The previous box renderer reduced the closed box to 69% during anticipation,
and the model clamped opening at 1, so its authored 1.12 overshoot never reached
the hinge. Charge now advances the box by up to 6.5%; the hinge permits the
overshoot and settles once. The shared ceremony timeline owns the box, cavity
light, atmosphere and viewport exposure. Reframing happens entirely under the
opaque white interval, after the lid releases. Light originates at the actual
projected front seal, expands across the page and then clears into card flight.
Single Mystery Box draws now use this same ceremony and manual card flip.

In-memory checks against the actual Three.js models confirmed opening 1.10,
charge scale ratio 1.0576 at 1.3 seconds, and 0.42 seconds of opaque exposure.
Browser playback covered seven boxes, one box, the remaining six boxes, and
the subsequent six Pro Memberships; all completed through manual card flips.
The prize-group boundary and explicit action to start Pro Membership remained.
New captures: `work/surf-draw-charge-v2.jpg` and
`work/surf-draw-release-v2.jpg`. These are stills, not a frame-rate measurement.

One older page instance reported `Renderer is not ready` after being left at
the card gallery. A fresh reload completed the single/batch/cross-group runs
without recurrence. The cause is unconfirmed; no automatic renderer restart
or fallback was added. OS reduced-motion switching and physical mobile GPU
performance were not tested. Visual acceptance remains with the user.

TypeScript, Vite, media isolation and diff-whitespace checks passed. The lazy
ceremony is 581.63 kB (152.28 kB gzip); the GPU core is still 2,541.71 kB
(711.04 kB gzip), retaining the existing large-chunk warning. Standards and Spec
reviews found no actionable issue in this revision. Approved Local Markdown
workflow settings were added to `AGENTS.md` and `docs/agents/`. No spec/ticket,
test source file, new branch, fallback, commit, push or deployment was created.

## Parked card turn — 2026-10-14

Clicking a parked card previously hid its DOM artwork, substituted a rasterized
WebGL card under an orthographic camera, then restored DOM at completion. That
changed its border, lettering and material during the turn. The new
`SurfDrawBatchCard` retains two DOM faces in the same grid cell, while
`turnSurfWinnerCard` performs a finite 820 ms perspective turn with an 8 px lift.
The completion state is committed before cancelling the animation fill, so
there is no jump back. Inactive faces are hidden at rest and both faces remain
in the sizing grid; long names cannot change neighbouring card positions.

Three.js still renders the box, launch and ticket hold. At identity it stops
drawing the parked cards; no winner-face rasterization or WebGL click turn
remains. Reveal accounting is notified only after the DOM turn finishes. The
last card still gates the next batch. Cancellation removes the motion listener,
and reduced motion completes without rotation, including a preference change
during a turn.

Browser checks at the user's 1218 × 853 viewport covered box cards, a long-name
card, the final-card group boundary and a Pro card turn. All seven card bounds
were identical before/after the long-name flip, and WebGL card draw calls stayed
at zero during DOM flipping. Cold reload reproduced the box batch and Pro
gallery. TypeScript, build, media audit and both review axes passed. This remains
a local visual review, not user acceptance or deployment. No fallback or test
source files were introduced. Captured turn: `work/surf-draw-card-turn-v3.jpg`.

## Pro booster opening — 2026-10-14

- Confirmed source of truth: `shared/surf-campaign.js` still defines 7 Mystery Boxes and 20 Pro month memberships. The remembered batch amount was 7; it was never a seven-membership prize pool. The stage now shows the total 20 separately from the selected batch.
- Visually inspected and operated https://metalforge.xyz/booster: selected pack, swiped the top seal, observed foil separation and cards rising from the opened mouth. Built original Renaiss × Surf artwork and geometry; no reference artwork or gated export was copied.
- `proBoosterArtwork.ts` draws the branded silver print. `createSurfProBooster.ts` owns two deformed foil skins, crimping, the opening mouth and detached seal. `proBoosterTimeline.ts` owns the finite release, extraction and gallery paths.
- After all selected results are confirmed, the user can swipe right across the seal or use the keyboard-accessible Open membership pack button. Preview and release share the same inverse-eased timeline, retaining the seal pose when the pointer releases. Cards keep their readable orientation, clear the sleeve, then fan and settle into the existing gallery. Parked DOM cards still flip individually.
- Single membership draws now use this same ceremony. Removed the unreachable single-card Stage branch. A DEV-only Replay Memberships control restarts an isolated fixture with seven demo box results, then rehearses seven of the twenty memberships. No API, ledger or transaction is called by replay.
- Browser QA at the actual 696 × 853 viewport: boxes complete first; All 20 produces 20 membership cards (slots 08–27); all twenty manual flips complete and show Simulation complete. Replayed the seven-card variant and inspected frames during seal removal, extraction and fan-out. The seal exits to the right below the heading. Both total 20 and batch 7 remain visible.
- Standards review: initial swipe snapback and unreachable Stage branch fixed; re-review has 0 unresolved findings. Spec review: 0 unresolved findings. Source confirms reduced-motion completion but OS preference switching was not exercised.
- Local preview only; visual acceptance remains with Gavin. No push/deploy, new image generation, fallback, or temporary test source files.
- Additional browser checks: after the seven-member batch, 13 memberships remain; selecting one opens the same foil pack for slot 15. The final build passed TypeScript, Vite and CDN asset isolation. Draw JS is 52.80 kB / 19.21 kB gzip; ceremony including Three.js is 584.89 kB / 153.42 kB gzip. The existing GPU core remains 2,541.71 kB / 711.04 kB gzip and triggers Vite's large-chunk warning; no release was performed.

## Pro foil and extraction correction — 2026-10-14

The initial booster version was rejected visually. Replayed the public Metalforge
Luxe/Tear preview and inspected frames through the rip, open mouth, stack lift,
wrapper descent and individual card removal. Its gated source/export was not
accessed. This revision remains an independent implementation with original
Renaiss artwork, not an integration of Metalforge code.

- Split foil shape and photographic materials into `proBoosterGeometry.ts` and
  `proBoosterMaterials.ts`. Front/back skins pinch at the crimped seams, reveal
  silver inner faces, and deform locally behind the moving tear front. A separate
  reflection environment preserves the bright page and existing chest lights.
- Replace the early wide fan with an intact, thin stack inside the wrapper. The
  sleeve occludes the lower cards, slides down, then the exposed stack enlarges
  before cards leave its top in sequence for the existing gallery. No identity is
  revealed automatically; every parked card still requires its manual turn.
- Reserve space above the pack for the seal gesture. Bound the detached strip's
  exit by viewport width so it is fully offscreen before hiding. Remove the
  duplicate bottom gesture hint which overlapped desktop batch controls.
- Bounded geometry reviews found and corrected a negative crimp half-thickness
  and a premature strip hide. Final minimum body half-thickness is 0.001558;
  initial card thickness is 0.37px against 0.60px spacing. Source raycasts for
  1/7/20-card batches found no early penetration through the front foil. Standards
  and Spec re-reviews each have zero unresolved findings.
- Browser playback covered 696×853 and 1280×900, including seven-card 4+3 layout,
  successful swipe, box-to-membership order, and all twenty memberships. All 20
  manual flips completed (`phase=revealed`, 20 cards, 20 revealed, Simulation
  complete), with no browser errors. The viewport override was reset afterward.
- Build, TypeScript and CDN media isolation passed. Ceremony JS including Three
  is 585.33 kB / 153.80 kB gzip. Existing GPU chunk-size warning remains. No new
  media/dependency, fallback, temporary test source file, chain action, push or
  deployment. Physical-device performance and OS reduced-motion switching were
  not exercised. Gavin's visual acceptance remains pending.

## Selectable Pro packs and continuous extraction — 2026-10-14

Gavin rejected the preceding extraction and asked for multiple selectable packs
that can rotate. The public Metalforge preview was inspected again; this remains
an original Renaiss implementation, without gated source/export or paid assets.

- Seven physical foil packs share one material/reflection set. Swipe beside the
  centre to browse, select a side pack or use arrows; drag the centre to rotate
  its front/back. Keyboard rotation and a Turn control are also available.
  Choosing a pack brings it forward and restores its front before manual tearing.
  Back to packs allows a different choice before opening. These choices affect
  presentation only and never select or change a draw result.
- `proBoosterCarousel.ts` owns finite selection/focus/rotation motion;
  `createProFoilPack.ts` owns the skins and corrected reverse-side UVs. The final
  carousel follows a continuous orbit, including its first/last-pack boundary.
  Idle packs stop rendering motion instead of wobbling indefinitely.
- Card proportions now stay at 1.6 for Pro tickets. They are packed upright as an
  intact stack, progressively exposed at the mouth, then rotated into reading
  orientation only after the bottom clears the sleeve. The same meshes deal
  into the existing manual-flip DOM gallery. Wrapper descent begins later and
  the canvas lower edge softly clips its final departure.
- Review caught a last-pack wrap jump, overlapping hit targets and fixed stack
  depth penetrating the foil at narrow sizes with twenty cards. All are fixed:
  periodic orbit, central hit z-index 5, packed spacing/thickness proportional to
  pouch width. Standards and Spec re-reviews report zero unresolved findings.
  Geometry checks covered 390×420/20 cards, and finite carousel/landing checks
  covered 1/7/20 cards without creating test source files.
- This is local visual work on the current branch. No new dependency, generated
  image, fallback, backend outcome change, chain action, commit, push or deploy.
  Previous screenshots remain retained; visual acceptance is still Gavin's.
- Final browser run after a cold reload: completed seven boxes, selected All 20,
  browsed first→last pack, dragged it to its readable reverse, focused it and tore
  the seal. All twenty Pro cards dealt and manually flipped; final DOM reported
  `cards=20`, `revealed=20`, `phase=revealed`, `Simulation complete`, with no console
  errors. Replayed seven memberships for user review afterward. Desktop viewport
  was 1280×900; the normal 696×853 layout was also inspected.
- Final TypeScript/Vite/CDN-isolation build passed, as did `git diff --check`.
  Draw JS: 58.14 kB / 21.47 kB gzip; ceremony including Three.js: 587.03 kB /
  154.30 kB gzip. The pre-existing 2,541.71 kB GPU core still emits the large-chunk
  warning. OS reduced-motion switching and physical-device performance remain
  untested; source lifecycle/reduced-motion checks passed.

## Taller packs and direct preview choice — 2026-10-14

- Pro foil packs now use a shared 1:1.86 aspect ratio, previously 1:1.48. Shape,
  artwork anchors, hit areas, extraction and sleeve departure use the same
  dimensions; logos and text retain their original proportions.
- DEV preview can start directly with either prize group and switch during
  preparation, opening or manual card reveals. The primary simulation action
  follows the selected prize tab. This only remounts the local fixture; real
  transactions and their prize order are unchanged.
- Browser verification covered direct membership entry, the taller selected pack
  and seal, opening into seven manual cards, then switching to boxes before
  flipping any card and switching straight back during preparation. No console
  errors were recorded. Preview choices are now visible pill buttons.
- Spec and Standards reviews found no unresolved issues. Twenty-card source
  raycasts at 390×420 and 1320×680 found no foil penetration; the card bottom
  clears the mouth before rotating into reading orientation.
- TypeScript, Vite and CDN asset-isolation checks passed. No new media, fallback,
  test source files, deletions, commit, push or deployment. Visual acceptance
  remains pending.

## Pro tear and draw selector refinement — 2026-10-14

- The draw selector now follows the site's thin underline tabs. Its previous
  oversized pill typography came from the page-wide `button { font: inherit }`
  rule overriding the scene's font size; the scoped selector fixes the cascade.
- A short pull eases back to a closed seal; completing the pull preserves the
  partial tear and finishes the opening. The detached strip moves beside the
  pouch, the mouth opens, and only then does the card stack rise. After review,
  the extra printed perforation, left foil tongue, side arrow and dark slit
  were removed: they did not line up with the 3D seal and looked like a second
  layer. The foil now separates at the bottom of its existing top crimp.
- The membership pouch uses the gallery's available height rather than reserving
  space for controls inside it. Its controls sit below the browsing carousel or
  beside the chosen pouch. The main draw controls previously covered the Open
  button and intercepted clicks; they now move out of the pack stage during the
  opening, with the local simulation exit still reachable.
- The Three scene is now exposed as ready only after its imperative controller
  is assigned. This closes the first-click race between GPU preparation and
  the focus/open controls.
- At a 1280×720 local preview, browser checks covered selector sizing, a short
  tear and reseal, a full rightward tear, foil departure, card extraction and
  exiting simulation. TypeScript, `git diff --check` and a local Vite build
  passed. The build used a non-deployment placeholder CDN base because no CDN
  base is configured in this shell. The existing large GPU bundle warning
  remains. No chain action, push or deployment occurred. Review screenshots:
  `work/surf-pro-tear-review-2026-10-14.png` and
  `work/surf-pro-tear-open-2026-10-14.png` captured the rejected seam version
  and remain in place pending user approval to remove test artifacts. Visual
  acceptance is still Gavin's.
- Follow-up correction: the tear boundary now follows the bottom of the top
  crimp. At 1280×720, the closed pack had no projecting left tab; the opening
  sequence showed no artificial dark slit, and the reveal completed without a
  persistent line. Local review frames are
  `work/surf-pro-seam-corrected-closed-2026-10-14.png` and
  `work/surf-pro-seam-corrected-open-2026-10-14.png`. TypeScript, Vite build,
  asset isolation and `git diff --check` passed again. This is still pending
  Gavin's visual acceptance; there was no push or deployment.
