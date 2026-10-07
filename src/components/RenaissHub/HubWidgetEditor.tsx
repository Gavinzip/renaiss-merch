import { useId, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { hubWidgetSize, type HubWidget } from "../../../shared/hub-preferences.js";
import type { HubWidgetCopy } from "./HubWidgetCopy";
import { HubWidgetFields } from "./HubWidgetFields";
import { HubWidgetSizePicker } from "./HubWidgetSizePicker";
import type { HubWidgetDrag } from "./useHubWidgetDrag";
import { HubWidgetDepth } from "./HubWidgetDepth";

export function HubWidgetFrame({
  widget, index, total, editing, copy, drag, onDragStart, onMove, onHide, onSettings, children,
}: {
  widget: HubWidget;
  index: number;
  total: number;
  editing: boolean;
  copy: HubWidgetCopy;
  drag: HubWidgetDrag | null;
  onDragStart: (event: PointerEvent, handle?: boolean) => void;
  onMove: (direction: -1 | 1) => void;
  onHide: () => void;
  onSettings: (value: HubWidget) => void;
  children: ReactNode;
}) {
  const [configuring, setConfiguring] = useState(false);
  const settingsId = useId();
  const name = widget.type === "feed" ? copy.sources[widget.source] : copy.widgets[widget.type];
  return (
    <div
      className={`hub-widget hub-widget--${widget.type}${editing ? " is-editing" : ""}${editing && configuring ? " is-configuring" : ""}`}
      data-widget-id={widget.id}
      data-size={hubWidgetSize(widget)}
      data-dragging={!!drag}
      id={widget.type === "feed" ? `portal-${widget.id}` : undefined}
      onPointerDown={(event) => onDragStart(event)}
      style={{ "--widget-index": index, "--widget-columns": widget.columns, "--wiggle-phase": `${index * -173}ms`, "--wiggle-duration": `${430 + (index % 3) * 47}ms`, ...(drag ? { height: drag.height } : {}) } as CSSProperties}
    >
      <div className="hub-widget__body" style={drag ? { position: "fixed", left: drag.left, top: drag.top, width: drag.width, height: drag.height } : undefined}>
        {editing ? (
          <div className="hub-widget__edit" aria-label={`${name} ${copy.customize}`}>
            <div className="hub-widget__tools">
              <button className="hub-widget__grab" type="button"
                onPointerDown={(event) => onDragStart(event, true)}
                aria-label={`${name} ${copy.drag}`} aria-describedby="hub-widget-drag-hint"
                aria-keyshortcuts="ArrowUp ArrowDown"
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" && index > 0) { event.preventDefault(); onMove(-1); }
                  if (event.key === "ArrowDown" && index < total - 1) { event.preventDefault(); onMove(1); }
                }}>
                <svg viewBox="0 0 16 20" aria-hidden="true"><circle cx="5" cy="5" r="1" /><circle cx="11" cy="5" r="1" /><circle cx="5" cy="10" r="1" /><circle cx="11" cy="10" r="1" /><circle cx="5" cy="15" r="1" /><circle cx="11" cy="15" r="1" /></svg>
                <span>{name}</span>
              </button>
              {(
                <button type="button" onClick={() => setConfiguring((value) => !value)}
                  aria-label={`${name} ${copy.editContent}`} aria-expanded={configuring}
                  aria-controls={settingsId} title={copy.editContent}>
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M4 14h12M7 3v6M13 11v6" /></svg>
                </button>
              )}
            </div>
            {configuring ? (
              <div id={settingsId} className="hub-widget__fill">
                <HubWidgetSizePicker widget={widget} copy={copy} onChange={onSettings} />
                {widget.type === "feed" ? <HubWidgetFields settings={widget} copy={copy} onChange={onSettings} /> : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="hub-widget__surface">
          <HubWidgetDepth>{children}</HubWidgetDepth>
          {editing ? (
            <button className="hub-widget__remove" type="button" onClick={onHide}
              disabled={total === 1} aria-label={`${name} ${copy.hide}`} title={copy.hide}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M6 14l8-8" /></svg>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
