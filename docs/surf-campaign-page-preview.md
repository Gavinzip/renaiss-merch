# Renaiss × Surf activity page preview

Local preview: `/v1.2/?preview=hub#campaign/surf`.

The Partner Quest widget and the existing top-right navigation now open a
page instead of a dialog. It has a real history entry, reloadable deep link,
native document scrolling and English/Traditional Chinese copy. Browser
Back and Forward work. Returning to the dashboard restores the entry control's
keyboard focus. The page header names the section “合作活動”; “返回總覽”
returns to the dashboard.

Hero, rewards, participation, route ownership and social-task controls are
separate modules under `src/components/RenaissHub`. No router dependency,
verification-rule change or new reward-allocation logic was introduced.

The hero uses the actual transparent official Surf Mystery Box, with no
decorative circle. Rewards use complete, proportion-preserving images and
no solid color backplates. The Pro trial has a real Surf product capture,
a short description of the research interface and an official product link.
See the research provenance at
`work/research/surf-campaign-2026-10-06/README.md`.

Per Gavin's low-token-cost constraint, `SurfCampaignArt` adds a small,
pointer-driven 2.5D perspective transform to the unchanged official alpha
artwork. It is not a procedural mesh or a 360° model. It adds no image
generation or Three.js runtime. Touch and reduced-motion modes stay static;
pointer leave, cancellation, tab hiding, setting changes and unmount reset
the artwork and cancel pending animation frames.

Guests see “登入以連接 X” / “登入以連接 Discord”, with a concise description
of the two-stage sign-in/authorization flow. Existing authenticated users
retain Connect, Verify, Recheck and Change Account controls. Only the provider
being checked displays Checking, while both providers remain disabled during
the shared request. Verification states remain server-derived; no follow,
membership or entry result is invented.

Both Renaiss login and X/Discord OAuth retain the page in `returnTo`. Older
dialog callbacks using `mission=x`, `mission=discord` or `mission=resume`
canonicalize to the new page before consumed query parameters are cleared.

Scope is development review. Surf's account API, final activity dates and
SBT claim details remain pending. The positive Discord-member case still
requires a genuine Surf member. This work does not push or deploy the preview.

## Local verification, 2026-10-07

- TypeScript and the configured build/media assert-build checks pass. The
  invalid compile-only CDN base used for the build check is not a deployment.
  Production asset names and sizes remain unchanged; campaign source images
  and research files are not included in the production chunks.
- Browser-checked 1440 px desktop and 390/320 px mobile layouts; Chinese and
  English titles fit without horizontal overflow. Reward image bounds match
  their frames, using `object-fit: contain` and no flat color backplates.
- Browser Back/Forward, keyboard Enter, return focus, canonical reload and
  the legacy `mission=discord` return link were checked. Callback query
  parameters clear while the campaign hash remains intact. Callback query
  outcomes are never treated as proof of a completed task.
- Real pointer input produces a bounded 3D transform; leaving the figure
  resets both rotation values to zero. The hero decorative circle is absent.
  Guests have visible named X/Discord sign-in controls. Existing authenticated
  connection/status controls were observed; no new successful membership
  claim is made from this visual pass.
- Screenshots: `work/reviews/surf-campaign-page-2026-10-07/desktop-hero.png`,
  `desktop-rewards.png` and `mobile-390.png`. No permanent test scripts or
  database fixtures were created. Browser viewport overrides and the earlier
  Aside reduced-motion override were restored; temporary research tabs closed.
