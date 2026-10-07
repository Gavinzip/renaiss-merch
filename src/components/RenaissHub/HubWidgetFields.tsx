import {
  HUB_PROJECTS,
  HUB_REGIONS,
  type HubFeedWidget,
} from "../../../shared/hub-preferences.js";
import type { HubWidgetCopy } from "./HubWidgetCopy";
import { fieldsForFeed } from "./hubWidgetPresets";

export function HubWidgetFields({
  settings,
  copy,
  onChange,
}: {
  settings: HubFeedWidget;
  copy: HubWidgetCopy;
  onChange: (value: HubFeedWidget) => void;
}) {
  return (
    <div className="hub-widget__settings">
      {fieldsForFeed(settings).map((field) => (
        <label key={field}>
          {copy[field]}
          <select
            value={settings[field]}
            onChange={(event) =>
              onChange({ ...settings, [field]: event.target.value })
            }
          >
            {(field === "project" ? HUB_PROJECTS : HUB_REGIONS).map((value) => (
              <option key={value} value={value}>
                {field === "project"
                  ? copy.projects[value as keyof typeof copy.projects]
                  : copy.regions[value as keyof typeof copy.regions]}
              </option>
            ))}
          </select>
        </label>
      ))}
      <fieldset className="hub-widget__count">
        <legend>{copy.count}</legend>
        <div>
          {([2, 3, 5] as const).map((count) => (
            <button
              type="button"
              key={count}
              aria-pressed={settings.count === count}
              onClick={() => onChange({ ...settings, count })}
            >
              {count}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
