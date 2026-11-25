# Hub navigation and original event archives

## Published release configuration (2026-10-20)

- Hub: https://merch.renaisscltb.com/?preview=hub&lang=zh-TW#events
- Football: https://merch.renaisscltb.com/events/football/?lang=zh-TW
- Pokémon: https://merch.renaisscltb.com/events/pokemon-30/?lang=zh-TW

The release includes the collapsed-by-default sidebar, bottom-left language menu,
original-style activity/prize/winner experiences, shared rainbow return control,
and diagonal per-element Widget entry. Store claim flows and scheduled Surf
availability retain the current main implementation.

## Local review

- Hub index: `http://127.0.0.1:5173/v1.2/?preview=hub#events`
- Pokémon: `http://127.0.0.1:5173/events/pokemon-30/?lang=zh-TW#winners`
- Football: `http://127.0.0.1:5173/events/football/?lang=zh-TW#winners`

The Hub retains its own colorful layout and collapsed-by-default navigation.
Its football and Pokémon archive cards link to separate full-page event documents. These use
independent Vite HTML entries, with the original event CSS, images and presentation
components. They are not iframes or preview cards. Legacy Hub event hashes forward
to these documents. Each document has a Back to Hub link. Explicit lang query parameters are respected
and kept in sync when changing languages, including when returning to Hub. Git publication includes the completed Hub surfaces and their release catalogs.
Only previously published winners are mirrored; original event services are retained.

## Surf and Worlds independent archives (local update, 2026-11-20)

The four archive cards open independent event documents under this Merch site.
Surf and Worlds follow the Pokémon/football import pattern: preserve the original
prize/winner presentation and published results without retaining the full retired
activity application. The original activity sites can be retired independently.

- Surf: `/events/surf/?lang=zh-TW`; winner CTA adds `#winners`. The original prize
  component and original draw-card faces show seven Mystery Boxes and twenty
  one-month Pro memberships. The cards use actual frozen winner names/tickets.
  There are no task verification, account, signer, operator or draw mutations in
  this document. A static prize artwork slot avoids loading the operator's full
  animation atlases for a completed result.
- Worlds: `/events/worlds-2026/?lang=zh-TW`; winner CTA adds `#winners`. The imported
  original WinnerPrizeDisplay, WinnerMatch and WinnersShowcase retain their
  presentation, product crops, team logos, counts and original translations.
  The stage query selects quarter/semi/final (4/2/1 primary winners). No original
  service/bootstrap/result API is used at runtime.
- Both independent headers use the same prominent rainbow `HubReturnButton`
  used by Pokémon and football. The target is always the Hub archive collection,
  with language preserved. This is independent of the general Hub header.
- Hub subpages (Store, Partner Quest, Binder and archive index) no longer render
  a generic back arrow. The sidebar switches pages; the brand returns to overview.
- Legacy `#events/{event}` and `/winners` hashes forward to the matching event
  document. The normal Partner Quest task page remains its existing feature.

Static results live in `src/event-archives/data/{surf,worlds-2026}.json`. Surf was
captured from the completed chain/locked-ledger result with a field allowlist of
slot, ticketNumber and sanitized display name. Its read-only capture command is
`node --env-file=.env.local scripts/capture-surf-archive.mjs`. The anonymous public
API added during the earlier attempt was removed; viewing these archives requires
no draw database, RPC, contact snapshots or old activity backend.

`node scripts/import-community-event-archives.mjs` imports Worlds's presentation
subset, public display data, three original canonical ECVRF bundles and required
media. All seven displayed tickets are compared with the verified bundle results;
SHA-256 pins every raw bundle and image. Only the presentation's required message
catalog entries are copied. Source hashes and the source checkout's actual dirty
state are recorded in `docs/community-event-archive-provenance.json`. Source
projects are read only. No AI media generation is involved.

Seventeen new retained media/proof objects total 2,104,441 bytes under
`work/assets/community-event-archives/`. Their catalog is
`media/community-event-archive-asset-release.json`. Local Vite development and the
normal local server have explicit development-only media paths. Production uses
versioned R2/CDN URLs and the production configuration check rejects an unpublished
catalog; there is no production local-file or application-server media fallback.
No new media was uploaded. Existing Surf artwork stays on its published Merch CDN.

The current normal local preview uses `http://127.0.0.1:5173/` because that origin
is already allowed by the public media bucket CORS policy. Port 5198 was not
allowed; its anonymous Store reveal preloads correctly failed CORS rather than
being proxied or hidden. Product verification uses the existing normal entrance,
Hub sidebar, archive cards and return controls. The temporary mobile viewport is
reset after checks. Review evidence: `work/reviews/self-contained-events-2026-11-20/`.

The update remains local, on `codex/surf-campaign-recap`, without Git push,
PR, CDN publication or production deployment. The original activity services have
not been shut down. Local checks do not imply user visual acceptance.

## Original presentations

- Pokémon uses the original white layout, original flat Celebration Box image
  with crystal glints, ten-person roster, Charizard model/scene/rotation controls,
  bonus awards, public ledger and transaction links. It retains original i18n,
  rule cards and fonts. The old login/participation CTA becomes archive navigation.
- Football uses the original trophy hero/video, floating dark navigation,
  original reveal film, SideRays stage, match-to-prize image mapping, sequential
  winner rows and on-chain proof drawer. All four published rounds can be reviewed.
  Account, vote, draw, sandbox and operator actions are not part of this archive.
  The hero film loops within the archive cover instead of scrubbing across the
  original long participation homepage. The winners film still has skip/replay.

## Source ownership and reproducible import

`node scripts/import-event-archive-source.mjs` reads presentation sources from:

- `/Users/gavin/Documents/ChatGPT/30th-ann-recovery-release`
- `/Users/gavin/renaiss_bnb_football`

It imports only the presentation dependency graph into
`src/event-archives/{event}/original/`, preserving relative structure. Original
source hashes are recorded in `docs/event-archive-provenance.json`. Adaptations
include archive asset URLs, extracting read-only football navigation/proof
components, removing irrelevant CSS, and mapping the original Draco decoder URLs
to the current Three.js loader API. Original source projects are never modified.
Inter/Urbanist font license notices are retained in `docs/licenses/event-archive/`.
No AI image generation was used.

## Published winner data

After source import, run `node scripts/import-event-archive-data.mjs` to collect
only the existing public announcements and five downloadable original ledgers:

- https://renaiss30th.zeabur.app/api/pokemon30/winners
- https://renaiss-worldcup.zeabur.app/api/draw-winners

The field allowlist retains public display names/X handles, masked wallet labels,
ticket numbers, award/match identifiers, public proofs and original public X
avatars. Emails, provider IDs, account metadata and alternates are not imported.
Pokémon has 10 Celebration Box winners, one Charizard winner and 22 bonus awards;
football has 15 primary winners over four rounds. The Pokémon ledger byte hash is
checked against the published ledger hash. The data is static at runtime, so
viewing the archives makes no account API requests to the retired services.

Known source omissions are retained explicitly:

- Four football quarter-final records lack reveal transaction hashes in the
  original API. Other proof links and downloaded ledgers remain available. No
  transaction hash is invented or replaced with a different draw.
- The original public X avatars for M91 and M97 return HTTP 404. These two retain
  the original component's initial badge, explicitly recorded as
  `avatarStatus: source-http-404`; other public avatars are copied intact. Other
  import/network errors stop the import instead of silently substituting assets.

The Hub imports only a small summary count, not the full winner data or event
runtime. Pokémon's model renderer is loaded when its original bonus stage enters
the viewport. Football's winners room is lazy loaded when opened.

## Media release boundary

Reviewed runtime media is stored under `work/assets/event-experiences/`, outside
`public` and `dist`. The separate Hub poster images remain in
`work/assets/event-archive/`. Their respective release catalogs are
`media/event-experience-asset-release.json` and
`media/hub-event-asset-release.json`, published to the existing production public R2 bucket, renaiss-merch-pilot-20261018.
The poster release is rd3dd09cd135f3df155aa; the runtime release is
rcf46f71ce3488f0343c1. All 50 objects were checked against decoded source SHA-256,
MIME, immutable caching, CORS, ETag and Content-Length. Seven JSON/decoder files
use gzip; decoded content remains byte-identical to the originals. The transfer
inventory is 13,905,853 bytes for 16,550,386 decoded bytes. Both background MP4s
and the original reveal film passed 1024-byte Range requests with HTTP 206.
The first uncompressed runtime release r4e9be5e321a29cdd1869 remains retained in
R2 for audit; no automatic delivery fallback points at it. Archive helpers fail
visibly for unpublished production assets. No media response body is proxied by
the application.
The original football reveal film already uses its permanent public R2 URL.

## Verification boundary

Local TypeScript/Vite builds, asset provenance, public counts, ledger delivery,
round selection, proof drawers, model rotation, language and Hub return paths
are checked separately from user visual acceptance. Original Three.js and
pre-existing legacy app chunks still trigger Vite's 500 kB advisory; event entries
remain separate from Hub and the model is deferred. The exact release snapshot passes the full npm production build on Node 22,
including TypeScript, contracts, media configuration and output audit. Both event
HTML entries are finalized for Vercel and have explicit static rewrites. The build
contains no image, video, font or model source media. Existing legacy and Three.js
chunk advisories remain; the Hub does not eagerly import event bundles or model
renderers. Production dependencies report zero audit vulnerabilities. Git push,
provider deployment, live behavior and user acceptance remain separate checks.

## Return to Hub control

Both event headers and the Pokémon footer use one shared HubReturnButton: a
soft rainbow metal finish, dark text, inset arrow and restrained hover highlight.
The shared HubReturn motion coordinator uses the existing 250ms / 8px / 3px
page-motion tokens. Only visible content pieces move, preserving fixed headers.
A temporary full-viewport color layer bridges the real document navigation; the
Hub removes it only after its actual archive content mounts. No iframe or duplicate
Hub preview is introduced. The one-use hubReturn query is removed on arrival.
Normal href semantics, modified clicks, keyboard activation and reduced-motion
direct navigation remain available. BFCache restoration clears exit styles.
No new animation library or generated media is added. The local-only CSS recipe
comes from the installed transitions-dev skill, commit
598d3d6ad89dabb4bdf742fd2e887ca53914a888; its source ownership notice is retained
in that skill's references/source-provenance.md.

The archive cover also disables the guest hero's unused sticky positioning, which
otherwise allowed its bottom scroll prompt to overlap the fixed header when
entering the winners anchor. Original imported presentation source is unchanged.
# BBW Bangkok archive — 2026-11-23

The fifth collection entry is `/events/bbw/`, with a direct `#winners` link and
the shared prominent return-to-Hub control. It retains the original Four.meme
travel-card renderer, venue photograph and brand marks as a small independent
archive, without its private draw room, submission workflow or live result API.

The read-only capture includes official rounds 5 and 6: five released, revealed
records each, with **nine distinct accounts across ten records**. `deitycat2002`
appears in both rounds. The public presentation now lists nine people once,
without round labels or round-switching controls; all original tickets and both
immutable proofs remain retained. Card numbers are presentation sequence numbers,
not substituted source draw ranks. This does not infer combined payout terms.
The index says the community draw has been revealed; it does not mark the
28–29 November venue event as already ended.

Each retained result was checked against its complete ECVRF bundle and actual
finalized BSC commitment/request evidence. Original canonical bundles are kept
with the archive media; a copied, independently replayable protocol verifies
the snapshot without requiring the Four.meme repository to remain available.
Run `scripts/import-bbw-event-archive.mjs` explicitly from the source checkout
with `BBW_ARCHIVE_CURRENT_ROUND=6` and that checkout's private environment to
repeat the capture. The SQL transaction is read only, and the capture requires
all five winners in each selected round to have been released and revealed.
Provenance is in `docs/bbw-event-archive-provenance.json`.

BBW's seven retained media/proof files join the existing unpublished community
archive catalog. Local preview uses its explicit local-only asset route;
production still requires an authorized R2/CDN release before deployment.

The BBW header uses the original transparent `public/assets/partners/renaiss-protocol.webp`
from the source project. The earlier opaque copy remains outside the runtime catalog
for provenance; no generated logo or CSS background-blending workaround is used.


## Published community archives — 2026-11-25

Surf, Worlds 2026 and BBW archives are included in the normal Merch build. The
24 new public media and proof objects are published to the existing
`renaiss-merch-pilot-20261018` bucket, under
`community-event-archives/rf8300cbc043a57f87208/`. Six JSON/SVG files use gzip;
source bytes and source hashes remain unchanged. The encoded release totals
2,738,377 bytes. All files use content-versioned URLs and immutable
caching. Local review captures and the superseded opaque logo remain excluded
from Git and deployment output. Both pre-build configuration and final artifact
checks now require this published archive release.
