# Renaiss Merch project rules

## Production media delivery

- Before any production deployment, upload every public image, video, font,
  3D/model file, poster, and other static media asset to Cloudflare R2/CDN.
- Do not ship source, concept, AI-generation working files, or other original
  production materials in `public` or `dist`.
- Product images and claim-only media remain eligibility-gated in private R2.
  The four T-shirt/Bracelet reveal MP4s are an explicit public exception: they
  are versioned public R2/CDN assets, anonymously preloaded before Store entry,
  and may be opened, downloaded, or shared without authentication. Eligibility
  still gates the reveal UI, claim access, and shipping data.
- Preserve HTTP range support for MP4 playback and scroll scrubbing. Configure
  immutable caching and compression for versioned public assets, but do not
  long-cache HTML, API, authentication, or callback responses.
- A production handoff is incomplete until live CDN URLs, response headers,
  cache policy, range requests, and load timing have been verified.

## Never proxy production media through Zeabur

- Previous slow merchandise loading was caused by sending large reveal-media
  response bodies through the Zeabur/Node application path. This added an
  unnecessary application-server and network bottleneck to every large
  download. Do not reintroduce that architecture.
- Treat Zeabur as the control plane only: it may authenticate the Renaiss
  session, evaluate product eligibility, and issue a `307` redirect containing
  a short-lived signed Cloudflare URL. The image/video response body itself
  must travel directly from Cloudflare R2/Worker/CDN to the browser and must
  never be streamed, buffered, or proxied through Zeabur in production.
- Keep genuinely private product/claim media gated. Its direct Cloudflare URL
  must be short-lived and signed. The four explicitly public reveal MP4s load
  from permanent content-versioned public CDN URLs instead.
- Preserve `Content-Length`, `Content-Type`, `ETag`, and HTTP range behavior on
  the Cloudflare response. Verify representative MP4 requests return
  `Accept-Ranges: bytes` and valid `206` responses.
- Local filesystem streaming is development-only. Do not add a production
  fallback from signed Cloudflare delivery to Zeabur/local streaming. A missing
  private-media origin, signing secret, object, or invalid response must fail
  visibly.
- Public versioned media must also load directly from R2/CDN. Zeabur should
  continue serving HTML, hashed application JS/CSS, API, auth, and callback
  routes, with their appropriate cache policies.
- Public versioned media may use the bucket's managed `r2.dev` origin in
  production. A custom domain is not a release requirement for this project.
- Public reveal MP4s must be downloaded anonymously before first Store entry
  and retained in browser Cache Storage by public release. Refresh and
  logout/login may decode again, but must not re-download the unchanged bytes.

## Storefront release mode

- `MERCH_STOREFRONT_MODE` is required and accepts only `preview` or
  `production`. A missing or invalid value must stop the server; do not choose
  a fallback mode.
- In `preview` mode, `/` serves the legacy entry and `/v1.2/` serves the new
  Store. Demo availability continues to use the temporary
  `MERCH_V12_DEMO_ENABLED` gate.
- In `production` mode, `/` serves the new Store and `/v1.2/` redirects
  canonically to `/` while preserving query parameters. The legacy entry must
  not be publicly routable.
- `production` mode must disable Demo on the server, reject the Demo API, and
  invalidate existing Demo sessions. Hiding the Demo button in the client is
  not sufficient.
