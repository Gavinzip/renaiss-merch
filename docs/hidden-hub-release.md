# Hidden Hub verification release (historical)

The public Community launch supersedes the entry routing described below.
See [community-launch.md](./community-launch.md) for the current release mode.

The deployed public entry stays in its current `MERCH_STOREFRONT_MODE=production`
mode. `/` keeps the existing Merch landing and Store, and `/v1.2/` keeps its
canonical redirect. Do not switch the service to `preview` for this release.

The new home is directly reachable at `/next/` and its Store at `/next/#store`.
There is no link to it from the public landing or Store. Hidden documents send
`X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: no-store`.
The path is intentionally accessible to anyone who has the URL.

## Temporary Surf display control

Set `MERCH_SURF_REWARDS_VISIBLE=false` on the Zeabur Merch service before release.
An omitted key also means hidden; only the explicit string `true` enables the
two preview cards. Empty or invalid values stop server startup. The value is
read at startup and returned by the no-store `/api/storefront/features` endpoint;
changing it requires a service restart, not a frontend rebuild.

The flag controls only the hidden new Store and the local Hub design preview:

- `false`: the original three physical releases, with no Surf cards.
- `true`: add Mystery Box (3 allocations, 120 SBT) and Pro one-month membership
  (20 allocations, 100 SBT), with the reviewed three-column desktop grid.

The currently public Store keeps its original three products even when the flag
is enabled for hidden-version verification. Preview cards do not add redemption
or claim access; their existing planned/unopened status remains.

Remove this temporary control when **Surf rewards formally open**, independently
of the date the new home replaces the public entry. That release must remove the
environment key, server flag/endpoint and client display gate together, then wire
the formally approved rewards into the released Store. Removing just the key
today keeps the rewards hidden. This is a future release gate, not an automatic
scheduled change.

## Required deployment configuration

The existing live service is `renaiss-merch`, domain `merch.renaisscltb.com`.
Its Dockerfile override was checked and is `null`; continue using the repository
Dockerfile and the configured GitHub branch.

Before uploading Git changes, configure a persistent `MISSIONS_TOKEN_ENCRYPTION_KEY`
with a fresh 32-byte base64 key on this service. The new persistent Renaiss OAuth
challenge store requires it for the existing public login as well as the hidden
home. Do not print it, put it in Git, or regenerate it on each deployment.
The October 7 service-variable audit found this key absent. After Gavin approved
the release, a fresh key and `MERCH_SURF_REWARDS_VISIBLE=false` were saved on the
specified Zeabur service. The key remains private and is not recorded here.

Keep the existing `PUBLIC_APP_ORIGIN`, Renaiss client/callback, private-media
delivery, ECPay, database volume and production-mode settings. The hidden route
is accepted by Renaiss return URLs, social mission return URLs and 7-Eleven
return URLs; authentication still returns to the same app origin.

Surf membership verification and X/Discord mission connections also need the
provider settings listed in `surf-missions-integration.md`. Those keys were not
found in the live service during this audit. The hidden UI can be reviewed with
Surf Store cards disabled; genuine provider verification remains pending those
settings and callback registration. Configuration errors remain visible.

## Media and build

Hub media uses the existing approved public R2 origin and a separate manifest,
`media/hub-asset-release.json`, to avoid changing the current 69 MB reveal release.
Six optimized AVIF/WebP objects total 519,466 bytes and were published at:

`https://pub-152183cd35ab428096bc92f48b651a94.r2.dev/merch/next/r6381c84662e9676e15cc/`

All six were checked for HTTP 200, MIME type, immutable cache headers and timing.
The sealed-box hero directly loads its AVIF and preserves the reviewed eight-second
sine zoom (1 → 1.02 → 1), pausing offscreen, in a hidden document and for reduced
motion. It no longer loads the local authoring HTML or GSAP runtime. Work files
are excluded from the Docker build context.

`npm run build` passed with the active CDN base and production storefront mode.
The build guard rejects offloaded raster/video files in `dist`, an unpublished
Hub manifest, and local authoring URLs in the browser build. Hub JS/CSS are separate
lazy chunks (40.4 KB / 25.2 KB gzip), loaded only when the hidden home is opened.

## Verification and pending handoff

Inline checks cover hidden-path matching, invalid flag values, social return URLs,
both public routing modes and hidden HTML headers. A real production-mode local
server preserves `/` and the `/v1.2/` redirect while serving `/next/`; hashed JS
returns Brotli and one-year immutable caching. Browser review covers the deployed
build and both Surf display states. No permanent test scripts or test databases
were created. Review screenshots are retained outside the repository.

The service settings confirm GitHub `Gavinzip/renaiss-merch`, branch `main`, root
directory `/`, watch path `*`, and an empty Dockerfile override. Gavin approved
Git upload on October 7. The local production build and required variables are
ready; push the approved code to `main`, wait for the automatic deployment,
then check clone/Dockerfile build logs, RUNNING, health, root/redirect/hidden routes,
runtime flag and live browser behavior. Do not describe local checks as live
acceptance or provider verification.
