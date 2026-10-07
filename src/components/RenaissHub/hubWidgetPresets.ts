import type {
  HubFeedSource,
  HubFeedWidget,
  HubWidget,
} from "../../../shared/hub-preferences.js";

type CoreType = Exclude<HubWidget["type"], "feed">;
export type HubWidgetPreset =
  | { id: CoreType; type: CoreType; fields: readonly [] }
  | {
      id: HubFeedSource;
      type: "feed";
      fields: readonly ("project" | "region")[];
    };

// Source belongs to the designed template. Users only fill its content slots.
// Existing version-1 layouts identify their template by source; no migration or
// rewriting of saved project/region choices is necessary.
export const hubWidgetPresets: readonly HubWidgetPreset[] = [
  { id: "official", type: "feed", fields: [] },
  { id: "community", type: "feed", fields: ["region"] },
  { id: "events", type: "feed", fields: ["region"] },
  { id: "products", type: "feed", fields: ["project"] },
  { id: "all", type: "feed", fields: [] },
  { id: "member", type: "member", fields: [] },
  { id: "questline", type: "questline", fields: [] },
  { id: "merch", type: "merch", fields: [] },
  { id: "partner", type: "partner", fields: [] },
];

export function presetForWidget(widget: HubWidget): HubWidgetPreset {
  return hubWidgetPresets.find(
    (preset) => preset.id === (widget.type === "feed" ? widget.source : widget.type),
  )!;
}

export function createPresetWidget(preset: HubWidgetPreset): HubWidget {
  return preset.type === "feed"
    ? {
        id: `feed-${crypto.randomUUID()}`,
        type: "feed",
        source: preset.id,
        project: "all",
        region: "all",
        count: 3,
        size: "large",
      }
    : { id: preset.type, type: preset.type };
}

export function fieldsForFeed(settings: HubFeedWidget) {
  const preset = presetForWidget(settings);
  // Preserve previously saved filters, even when they predate the collection.
  return (["project", "region"] as const).filter(
    (field) => preset.fields.some((slot) => slot === field) || settings[field] !== "all",
  );
}
