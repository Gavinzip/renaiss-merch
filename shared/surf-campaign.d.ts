export const surfCampaign: Readonly<{
  id: "surf-renaiss-v1";
  phase: "integration";
  surfUrl: string;
  xUrl: string;
  xHandle: string;
  xUserId: string;
  discordUrl: string;
  discordGuildId: string;
  campaignUrl: string | null;
  plannedRewards: Readonly<{ mysteryBoxes: number; proMonthTrials: number }>;
  tasks: readonly Readonly<{ id: "accounts" | "x-follow" | "discord-join"; required: boolean; entries: number }>[];
}>;
