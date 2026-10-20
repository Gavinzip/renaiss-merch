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
Its two archive cards link to separate full-page event documents. These use
independent Vite HTML entries, with the original event CSS, images and presentation
components. They are not iframes or preview cards. Legacy Hub event hashes forward
to these documents. Each document has a Back to Hub link. Explicit lang query parameters are respected
and kept in sync when changing languages, including when returning to Hub. Git publication includes the completed Hub surfaces and their release catalogs.
Only previously published winners are mirrored; original event services are retained.

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
