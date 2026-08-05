# Renaiss Merch project rules

## Production media delivery

- Before any production deployment, upload every public image, video, font,
  3D/model file, poster, and other static media asset to Cloudflare R2/CDN.
- Do not ship source, concept, AI-generation working files, or other original
  production materials in `public` or `dist`.
- Eligibility-gated merchandise reveal media must stay in a private R2 bucket.
  Never expose a permanent public CDN URL that bypasses the access check. Serve
  it through the authenticated application route or a short-lived signed URL.
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
- Keep private media access gated. The direct Cloudflare URL must be
  short-lived and signed; a permanent public URL is not an acceptable speed
  optimization.
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
- A repeated private-media download after logout/login is a separate browser
  cache/session-lifecycle decision. Even when a re-download is required, its
  bytes must still come directly from Cloudflare rather than Zeabur.

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
