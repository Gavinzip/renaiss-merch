# Renaiss Community public entry

With `MERCH_STOREFRONT_MODE=production`, `/` serves the new app. A fresh visit
opens the coloured-prism entry; entering leads to the Community dashboard, and
the dashboard's Merch control opens the integrated Store with the shared header.
`/v1.2/` redirects to `/` and `/next/` remains a noindex direct alias for old
review links. In `preview` mode, `/` remains the legacy entry and `/v1.2/`
continues to host the new app.

Keep `MERCH_SURF_REWARDS_VISIBLE=false` for this release. The Store then shows
only its original three products. The Community partner campaign and its task
verification remain accessible outside the Store. Remove the temporary Surf
display switch only when Surf rewards formally open, together with its server
endpoint and client gate.

Before treating the release as deployed, verify the GitHub branch, repository
Dockerfile source and empty Zeabur Dockerfile override, a fresh successful
deployment, `/healthz`, the Store feature endpoint, browser entry/dashboard/
Store navigation, and public media/CDN cache and range headers. The current
mission ledger and backup procedures are documented separately.
