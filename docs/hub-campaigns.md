# The permanent community activity slot

The existing `partner` widget ID is retained so saved homepage layouts continue
to work. Its public label is 活動 / Activities / 활동.
The slot stays on the homepage while its selected campaign changes.

## Manual editorial updates

Edit `src/config/hubCampaigns.ts`. `activeCampaignId` selects an entry in
`hubCampaigns`; an unknown ID fails visibly rather than silently choosing an old
campaign. The selected entry owns the title, public destination, localized
description, three participation steps and deadline. The homepage, widget
collection and sidebar use this same selection. Rebuild and restart the normal
application after changing the file.

The sidebar flag always opens the Hub's own `#activities` page. It shows the
selected campaign's description, participation steps and deadline in the normal
Hub shell; its explicit "前往活動" action opens the official site. The shared
navigation follows this same internal route from the homepage, archives, Store
and public verifier. `#campaign/surf` remains the original Surf mission route.
The existing route motion owns page changes, focus and browser Back/Forward.

`fourmeme-bbw-2026` links to the official
`https://renaiss-fourmeme-bbw.vercel.app/thailand/` page, with the selected Hub
language. Its submission deadline is 2026-11-21 15:00 Asia/Taipei, separately from
the Bangkok event dates. Eligibility, X verification, submission receipt and
winners belong to that official site. Merch displays participation instructions,
never synthetic completion checkmarks or inferred eligibility.

Source checked with the owning 「確認 X 指定貼文轉推驗證」 chat and the published
Four.meme main revision `3e9bc2d` on 2026-11-20. Its canonical activity page is
`/thailand/`; `#community` is the participation section. Only the community group
requires Renaiss login. The currently published repost gate is disabled; Merch
does not add a repost requirement or claim to verify X content.

The explicit `surf` selection reuses the original Surf widget and existing
`#campaign/surf` route. Existing Surf routes and account/claim records remain
available regardless of which campaign is featured.

This is source-managed editorial configuration. It does not add a browser admin
editor, a new administrator role or a database write. A future admin editor must
have its own authorization and durable storage rather than reusing homepage
preferences or treating fulfillment permissions as campaign permissions.
