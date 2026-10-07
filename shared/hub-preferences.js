export const HUB_WIDGET_TYPES = [
  "member",
  "questline",
  "merch",
  "partner",
  "feed",
];
export const HUB_WIDGET_SIZES = ["small", "medium", "large"];
const defaultSizes = { member: "small", questline: "large", merch: "medium", partner: "small", feed: "small" };
// Version-1 layouts without a size keep their original compact presentation.
export function hubWidgetSize(widget) { return widget.size ?? defaultSizes[widget.type]; }
export const HUB_FEED_SOURCES = [
  "all",
  "official",
  "community",
  "events",
  "products",
];
export const HUB_PROJECTS = [
  "all",
  "tcg",
  "index",
  "defi",
  "game",
  "hackathon",
  "outreach",
];
export const HUB_REGIONS = [
  "all",
  "global",
  "tw",
  "kr",
  "my",
  "vn",
  "th",
  "multi_region",
  "unknown",
];
export const HUB_MAX_WIDGETS = 8;

function createDefaultActivityWidget() {
  return {
    id: "activities", type: "feed", source: "events", project: "all",
    region: "all", count: 2, size: "small",
  };
}

export function createDefaultHubPreferences() {
  return {
    version: 1,
    layout: "overview",
    widgets: [
      { id: "member", type: "member" },
      { id: "partner", type: "partner", size: "medium" },
      createDefaultActivityWidget(),
      { id: "merch", type: "merch" },
      {
        id: "community",
        type: "feed",
        source: "official",
        project: "tcg",
        region: "all",
        count: 3,
        size: "large",
      },
    ],
  };
}

// Only the untouched previous default is upgraded visually. A saved custom
// layout (including hidden cards, ordering, sizes or feed filters) stays custom.
export function usesHubOverviewLayout(preferences) {
  if (preferences.layout !== undefined) return preferences.layout === "overview";
  const legacy = [
    { id: "member", type: "member" },
    { id: "questline", type: "questline" },
    { id: "merch", type: "merch" },
    { id: "partner", type: "partner", size: "medium" },
    { id: "community", type: "feed", source: "all", project: "all", region: "all", count: 3, size: "large" },
  ];
  return preferences.widgets.length === legacy.length && preferences.widgets.every((widget, index) => {
    const expected = legacy[index];
    return widget.id === expected.id && widget.type === expected.type &&
      hubWidgetSize(widget) === hubWidgetSize(expected) &&
      (widget.type !== "feed" || ["source", "project", "region", "count"].every(key => widget[key] === expected[key]));
  });
}

// One validation contract for browser storage and account persistence.
export function validateHubPreferences(value) {
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.widgets) ||
    value.widgets.length > HUB_MAX_WIDGETS
  ) {
    throw new Error("invalid_hub_preferences");
  }
  if (value.layout !== undefined && !["overview", "custom"].includes(value.layout)) {
    throw new Error("invalid_hub_layout");
  }
  if (value.density !== undefined && !["compact", "comfortable"].includes(value.density)) {
    throw new Error("invalid_hub_density");
  }
  const ids = new Set();
  const uniqueTypes = new Set();
  const widgets = value.widgets.flatMap((widget) => {
    if (
      !widget ||
      typeof widget.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(widget.id) ||
      ids.has(widget.id) ||
      !(HUB_WIDGET_TYPES.includes(widget.type) || widget.type === "assistant")
    ) {
      throw new Error("invalid_hub_widget");
    }
    ids.add(widget.id);
    if (widget.size !== undefined && !HUB_WIDGET_SIZES.includes(widget.size)) {
      throw new Error("invalid_hub_widget_size");
    }
    const size = widget.size === undefined ? {} : { size: widget.size };
    if (widget.columns !== undefined && ![4, 5, 6, 7, 8, 12].includes(widget.columns)) {
      throw new Error("invalid_hub_widget_columns");
    }
    const footprint = widget.columns === undefined ? size : { ...size, columns: widget.columns };
    // Explicit migration: AI now lives in a dialog. Preserve every other card's
    // ID, size and order, including an intentionally empty home.
    if (widget.type === "assistant") return [];
    if (widget.type !== "feed") {
      if (uniqueTypes.has(widget.type)) throw new Error("duplicate_hub_widget");
      uniqueTypes.add(widget.type);
      return { id: widget.id, type: widget.type, ...footprint };
    }
    if (
      !HUB_FEED_SOURCES.includes(widget.source) ||
      !HUB_PROJECTS.includes(widget.project) ||
      !HUB_REGIONS.includes(widget.region) ||
      ![2, 3, 5].includes(widget.count)
    ) {
      throw new Error("invalid_hub_feed_settings");
    }
    return {
      id: widget.id,
      type: "feed",
      source: widget.source,
      project: widget.project,
      region: widget.region,
      count: widget.count,
      ...footprint,
    };
  });
  const preferences = { version: 1, ...(value.layout === undefined ? {} : { layout: value.layout }), ...(value.density === undefined ? {} : { density: value.density }), widgets };
  // Upgrade only the default overview, including its untouched legacy shape.
  // Deliberately customized homes keep their selected widgets and ordering.
  if (!usesHubOverviewLayout(preferences)) return preferences;
  const overviewWidgets = widgets.filter(widget => widget.type !== "questline").map(widget =>
    widget.id === "community" && widget.type === "feed"
      ? { ...widget, source: "official", project: "tcg", region: "all", count: 3, size: "large" }
      : widget,
  );
  if (!overviewWidgets.some(widget => widget.id === "activities")) {
    if (overviewWidgets.length >= HUB_MAX_WIDGETS) throw new Error("invalid_hub_overview");
    overviewWidgets.push(createDefaultActivityWidget());
  }
  return { ...preferences, layout: "overview", widgets: overviewWidgets };
}
