# Renaiss Merch for iPhone

Open `RenaissMerch.xcodeproj` in Xcode 27.1. The app starts at the real production
homepage, `https://merch.renaisscltb.com`, and keeps the website's complete shell,
navigation, account permissions, store and binder. It is an online WebKit app;
it does not provide an offline copy or substitute collection data.

## Build and install

```sh
zsh ios/scripts/build-simulator.sh
# The script prints the .app path. Install that path on the selected simulator:
xcrun simctl install booted /absolute/path/to/RenaissMerch.app
```

For a physical iPhone, select the correct Apple development team in Xcode's
Signing & Capabilities, connect the device and run the shared RenaissMerch scheme.
The initial project uses the team from the local development certificate and
bundle ID `com.renaiss.merch`. Confirm the intended distribution team before
registering an App Store record, creating profiles or uploading a build. Those
actions are separate from a simulator build and have not been performed.

Build products belong outside this repository. Xcode user settings are ignored.
The icon is a crop of the existing official protocol logo on the shared canvas
color; it is bundled for iOS, not added to the website's public media.

## Duo layout

The WKWebView follows its own view bounds through frame/autoresizing, with no fixed
screen sizes, extra browser controls or resize debounce. WebKit owns automatic
inset adjustment so normal `viewport-fit=contain` routes avoid the camera, while
the binder's `cover` canvas receives CSS safe-area insets. Frame sizing also
survives WebKit moving the view into and out of an element-fullscreen window;
parent Auto Layout constraints would be removed during that handoff.
Both portrait and landscape are supported.
The native controller requests an immersive presentation without a permanent
status/home-indicator rail. `MerchNativeLayout.css`, installed only in the exact
Merch HTTPS main frame, removes the browser document's whole-body safe-area
padding. Backgrounds and the book can then paint to the scene edges, while
normal content surfaces, navigation, dialogs, the ink toolbar and the bottom
pager retain their own safe insets. This is the App's layout integration, not a
replacement page or a static-color extension. Separate archive/draw documents
also opt into cover within the App and protect their navigation controls.
The binder responds to its available viewport: the outer display shows its
cover; the inner display opens to the previous spread. Page turns, pocket
inspection and writing are the existing product features.

Use the normal menu to reach My Binder. The explicit practice control can load
the sample general cards or SBTs already supported by the product; it never
changes the signed-in account's actual collection. There is no default sample
session or alternate demo entry in the app.

## Renaiss authentication

1. The normal website login begins `/api/auth/renaiss/start` inside the app.
2. The server saves the existing PKCE challenge and sets its HttpOnly cookie in
   the app's persistent WKWebsiteDataStore.
3. The navigation delegate sends only the expected Renaiss authorize redirect
   to ASWebAuthenticationSession. Credentials and provider screens stay in the
   system authentication interface.
4. A domain-verified HTTPS callback returns to the same WKWebView and its
   challenge cookie. The existing backend validates state, exchanges the code,
   verifies the identity, creates the session and redirects to the original
   product route. No tokens or cookies are copied into JavaScript or native
   preferences. The app also validates the returned state and exact origin.

Apple requires the `webcredentials` Associated Domain and the public
`/.well-known/apple-app-site-association` JSON to agree on the signed app ID.
The association file in `public/` must be published before native login can be
verified against production. It grants only `2LC6G3H9DB.com.renaiss.merch` the
association; no universal-link rule captures ordinary website login callbacks.
Changing the signing team requires updating this file as well. Missing domain
verification fails visibly; there is no embedded-browser authentication fallback.

X and Discord mission authorization use the same system-session handoff, with
separate exact provider paths, callback paths and state validation. The original
server mission challenge cookies remain in the initiating web view. A shipping
store selection stays in that web view for the explicit ECPay POST flow and its
POST callback; ordinary external links open through the system.

## Downloads

User-requested HTTPS files and same-origin blob/CSV exports use WKDownload and
the native Save/Share sheet. Each transfer owns an independent UUID directory;
untrusted suggested filenames never determine its cleanup parent. A completed
download waits for an existing dialog, login or picker to close and for the app
to be foreground before showing its sheet. Completion, cancellation, failure and
scene disconnection clean only that owned directory. Media response bodies still
travel directly from the website's configured CDN, not through a native proxy.

## Development verification

On 2026-10-25–26, Xcode 27.1 built this app and installed it on the iPhone Duo iOS
27.1 simulator. Testing used the actual production homepage and normal menu,
then the explicitly selected sample-card binder. Closed cover, open spread,
page turns, card inspection/removal/reinsertion, hand drawing, erasing, text
placement/undo, language selection and the original sidebar were exercised.
Element fullscreen was entered, folded, exited and unfolded without a reload.
The sample test marks were removed through the product's undo control.

The Foundation-only navigation/download-location checks passed 111 assertions;
the real static server returned the exact association JSON with the correct MIME
type. The existing pilot web build passed. Native authentication, social mission
completion, real collection saving/reloading, shipping and permission-gated
exports are still pending the published association file and authenticated QA.
The system authentication handoff is not yet an end-to-end success claim. The
expected WebKit policy-cancellation error (domain/code 102) no longer replaces
the page with a network-error panel. They have not been replaced with mocked
sessions or data. The approved detail/drawer close-control insets and dark guest
practice-button text are included in the App; matching web CSS is prepared but
has not been published.

Actual Duo recordings cover the full-bleed landing, original sidebar, cover,
spread, page turn, sample-card removal/reinsertion and fullscreen restoration.
The first visible frames of display handoff are retained, including the system
rotation/scale transition; first-frame motion still needs final visual review.
No physical-device result or simulator-bug attribution is claimed.

## Release boundary

This is an installable development app, not an App Store approval claim. Before
TestFlight/App Store distribution, verify a real native login, collection saving
and reloading, physical-device fold behavior, privacy-policy access, account
deletion, and the final privacy labels against all website data flows. The
privacy manifest reflects known identity, wallet, collection/writing and
fulfillment data used for app functionality; it is not a completed App Store
privacy questionnaire. No third-party native SDKs or tracking permissions are
added. App Review 4.2 requires a product beyond a repackaged website; agree the
intended native product scope before submitting.
