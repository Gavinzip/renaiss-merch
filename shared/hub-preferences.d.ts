export type HubFeedSource =
  | "all"
  | "official"
  | "community"
  | "events"
  | "products";
export type HubProject =
  | "all"
  | "tcg"
  | "index"
  | "defi"
  | "game"
  | "hackathon"
  | "outreach";
export type HubRegion =
  | "all"
  | "global"
  | "tw"
  | "kr"
  | "my"
  | "vn"
  | "th"
  | "multi_region"
  | "unknown";
export type HubWidgetSize = "small" | "medium" | "large";
export type HubWidgetColumns = 4 | 5 | 6 | 7 | 8 | 12;
export type HubCoreWidgetType = "member" | "questline" | "merch" | "partner";
export type HubFeedWidget = {
  id: string;
  type: "feed";
  source: HubFeedSource;
  project: HubProject;
  region: HubRegion;
  count: 2 | 3 | 5;
  size?: HubWidgetSize;
  columns?: HubWidgetColumns;
};
export type HubWidget =
  | {
      [Type in HubCoreWidgetType]: { id: string; type: Type; size?: HubWidgetSize; columns?: HubWidgetColumns };
    }[HubCoreWidgetType]
  | HubFeedWidget;
export type HubPreferences = { version: 1; layout?: "overview" | "custom"; density?: "compact" | "comfortable"; widgets: HubWidget[] };
export const HUB_WIDGET_TYPES: readonly HubWidget["type"][];
export const HUB_FEED_SOURCES: readonly HubFeedSource[];
export const HUB_PROJECTS: readonly HubProject[];
export const HUB_REGIONS: readonly HubRegion[];
export const HUB_MAX_WIDGETS: number;
export const HUB_WIDGET_SIZES: readonly HubWidgetSize[];
export function hubWidgetSize(widget: HubWidget): HubWidgetSize;
export function createDefaultHubPreferences(): HubPreferences;
export function usesHubOverviewLayout(preferences: HubPreferences): boolean;
export function validateHubPreferences(value: unknown): HubPreferences;
