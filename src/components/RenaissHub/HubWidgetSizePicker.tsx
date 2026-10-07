import { HUB_WIDGET_SIZES, hubWidgetSize, type HubWidget } from "../../../shared/hub-preferences.js";
import type { HubWidgetCopy } from "./HubWidgetCopy";

export function HubWidgetSizePicker({ widget, copy, onChange }: {
  widget: HubWidget; copy: HubWidgetCopy; onChange: (widget: HubWidget) => void;
}) {
  return <fieldset className="hub-size-picker">
    <legend>{copy.size}</legend>
    <div>{HUB_WIDGET_SIZES.map(size => <button key={size} type="button"
      aria-label={`${copy.size} ${copy.sizes[size]}`} aria-pressed={hubWidgetSize(widget) === size}
      onClick={() => onChange({ ...widget, size, columns: undefined })}>
      <span className={`hub-size-picker__shape hub-size-picker__shape--${size}`} aria-hidden="true" />
      <span>{copy.sizes[size]}</span>
    </button>)}</div>
  </fieldset>;
}
