// Public targets confirmed from @SurfAIHQ on 2026-10-06. This is a preview,
// not a published campaign: dates and final rules remain unset.
export const surfCampaign = Object.freeze({
  id: "surf-renaiss-v1",
  phase: "integration",
  surfUrl: "https://asksurf.ai/chat",
  xUrl: "https://x.com/SurfAIHQ",
  xHandle: "SurfAIHQ",
  xUserId: "2064498034822828032",
  discordUrl: "https://discord.gg/Bc76WjteSf",
  discordGuildId: "1509589929846640761",
  campaignUrl: null,
  plannedRewards: Object.freeze({ mysteryBoxes: 7, proMonthTrials: 20 }),
  tasks: Object.freeze([
    Object.freeze({ id: "accounts", required: true, entries: 1 }),
    Object.freeze({ id: "x-follow", required: false, entries: 1 }),
    Object.freeze({ id: "discord-join", required: false, entries: 1 }),
  ]),
});
