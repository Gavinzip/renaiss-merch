import { usesHubOverviewLayout, type HubPreferences, type HubWidgetColumns } from '../../../shared/hub-preferences.js';

const overviewOrder = ['member', 'partner', 'activities', 'merch', 'community'];
const overviewColumns: HubWidgetColumns[] = [4, 4, 4, 5, 7];

// Materialize the preset's actual footprints before editing. Browsing, dragging
// and saving then consume the same DOM order and grid, with no editor-only layout.
export function visibleHubLayout(preferences: HubPreferences): HubPreferences {
  if (!usesHubOverviewLayout(preferences)) return preferences;
  return {
    ...preferences,
    density: 'compact',
    widgets: [...preferences.widgets]
      .sort((a, b) => overviewOrder.indexOf(a.id) - overviewOrder.indexOf(b.id))
      .map(widget => ({ ...widget, columns: overviewColumns[overviewOrder.indexOf(widget.id)] })),
  };
}

export function editableHubLayout(preferences: HubPreferences): HubPreferences {
  return { ...structuredClone(visibleHubLayout(preferences)), layout: 'custom' };
}
