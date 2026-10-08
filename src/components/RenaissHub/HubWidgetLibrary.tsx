import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { HUB_MAX_WIDGETS, hubWidgetSize, usesHubOverviewLayout, type HubPreferences, type HubWidget } from "../../../shared/hub-preferences.js";
import type { HubWidgetCopy } from "./HubWidgetCopy";
import { HubWidgetFields } from "./HubWidgetFields";
import { HubWidgetSizePicker } from "./HubWidgetSizePicker";
import { useModalDialog } from "../../hooks/useModalDialog";
import { HubWidgetDepth } from "./HubWidgetDepth";
import { createPresetWidget, hubWidgetPresets, presetForWidget } from "./hubWidgetPresets";

const glyphs = { official: "↗", community: "◎", events: "◷", products: "◈", all: "✳", member: "○", questline: "⌁", merch: "◇", partner: "×" };

export function HubWidgetLibrary({ preferences, copy, onAdd, onUpdate, onRestoreDefault, disabled, restoreSelection, renderPreview }: {
  preferences: HubPreferences; copy: HubWidgetCopy; onAdd: (widget: HubWidget) => void;
  onUpdate: (widget: HubWidget) => void; disabled: boolean; restoreSelection: HubWidget | null;
  onRestoreDefault: () => void;
  renderPreview: (widget: HubWidget) => ReactNode;
}) {
  const libraryId = useId();
  const dialog = useModalDialog();
  const open = dialog.phase !== "closed";
  const [selection, setSelection] = useState<HubWidget>(() => createPresetWidget(hubWidgetPresets.find(preset => preset.id === "all")!));
  const [status, setStatus] = useState("");
  const [presetNotice, setPresetNotice] = useState("");
  const [previewRequest, setPreviewRequest] = useState(0);
  const previewHeading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (restoreSelection) { dialog.open(); setSelection(restoreSelection); setStatus(""); setPreviewRequest(value => value + 1); }
  }, [restoreSelection]);
  useEffect(() => {
    if (previewRequest) previewHeading.current?.scrollIntoView({ block: matchMedia("(max-width: 720px)").matches ? "start" : "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [previewRequest]);
  const preset = presetForWidget(selection);
  const name = selection.type === "feed" ? copy.sources[selection.source] : copy.widgets[selection.type];
  const full = preferences.widgets.length >= HUB_MAX_WIDGETS;
  const existing = selection.type !== "feed" ? preferences.widgets.find(widget => widget.type === selection.type) : undefined;

  return <section className="hub-editor" data-open={open} aria-label={copy.customize} inert={disabled}>
    <div className="hub-editor__heading"><div><h2>{copy.editTitle}</h2><p>{copy.editDescription}</p></div>
      <div className="hub-editor__layout-actions">
      <button className="hub-editor__preset" type="button" aria-pressed={usesHubOverviewLayout(preferences)} onClick={() => { onRestoreDefault(); setPresetNotice(copy.overviewApplied); }}>{copy.overviewPreset}<span aria-hidden="true">↗</span></button>
      <button className="hub-editor__open" type="button" aria-expanded={open} aria-controls={libraryId} onClick={() => open ? dialog.close() : dialog.open()}>
        <span className="hub-editor__plus" aria-hidden="true">+</span>{open ? copy.closeLibrary : copy.add}<small>{preferences.widgets.length} / {HUB_MAX_WIDGETS}</small>
      </button>
      </div>
    </div>
    {presetNotice && usesHubOverviewLayout(preferences) ? <p className="hub-editor__preset-notice" role="status">{presetNotice}</p> : null}
    <dialog ref={dialog.ref} className="hub-library-dialog" data-phase={dialog.phase} aria-label={copy.library}
      onCancel={event => { event.preventDefault(); dialog.close(); }}
      onClick={event => { if (event.target === event.currentTarget) dialog.close(); }}>
    <div className="hub-library" id={libraryId}>
      <button className="hub-library__close" type="button" onClick={dialog.close} aria-label={copy.closeLibrary}>×</button>
      <div className="hub-library__heading"><h2 tabIndex={-1}>{copy.library}</h2><p>{copy.restoreHint}</p></div>
      <div className="hub-library__workspace">
        <nav className="hub-library__catalog" aria-label={copy.library}>
          {(["feed", "core"] as const).map(group => <div key={group} className="hub-library__group">
            <span>{group === "feed" ? copy.communityCategory : copy.essentials}</span>
            <div>{hubWidgetPresets.filter(item => group === "feed" ? item.type === "feed" : item.type !== "feed").map(item => {
              const current = item.type !== "feed" ? preferences.widgets.find(widget => widget.type === item.type) : undefined;
              const label = item.type === "feed" ? copy.sources[item.id] : copy.widgets[item.type];
              return <button className={`hub-preset hub-preset--${item.id}`} type="button" key={item.id}
                aria-label={label} aria-pressed={preset.id === item.id}
                onClick={() => { setSelection(current ? structuredClone(current) : createPresetWidget(item)); setStatus(""); setPreviewRequest(value => value + 1); }}>
                <span className="hub-preset__glyph" aria-hidden="true">{glyphs[item.id]}</span>
                <span className="hub-preset__label"><strong>{label}</strong><small>{current ? copy.alreadyAdded : copy.available}</small></span>
                <span className="hub-preset__arrow" aria-hidden="true">{preset.id === item.id ? "●" : "›"}</span>
              </button>;
            })}</div>
          </div>)}
        </nav>
        <div className="hub-library__detail">
          <div ref={previewHeading} className="hub-library__selected"><div><span>{copy.readyMade}</span><h3>{name}</h3></div><p>{copy.presetDescriptions[preset.id]}</p></div>
          <HubWidgetSizePicker widget={selection} copy={copy} onChange={setSelection} />
          <div className="hub-library__stage">
            <span className="hub-library__preview-label">{copy.preview}<span>{copy.sizes[hubWidgetSize(selection)]}</span></span>
            <div className="hub-library__preview t-resize" data-size={hubWidgetSize(selection)} role="img" aria-label={`${copy.preview} · ${name} · ${copy.sizes[hubWidgetSize(selection)]}`}>
              <div inert><HubWidgetDepth>{renderPreview(selection)}</HubWidgetDepth></div>
            </div>
          </div>
          <p className="hub-library__preview-note">{copy.previewNote}</p>
          <div className="hub-library__fill">
            {selection.type === "feed" ? <HubWidgetFields settings={selection} copy={copy} onChange={setSelection} /> : <span className="hub-library__availability">{existing ? copy.alreadyAdded : copy.available}</span>}
            <button className="hub-library__add" type="button" disabled={!existing && full}
              onClick={() => {
                if (existing) { onUpdate({ ...existing, size: hubWidgetSize(selection), columns: selection.columns }); setStatus(`${name} · ${copy.updated}`); }
                else { onAdd(selection); setStatus(`${name} · ${copy.added}`); if (selection.type === "feed") setSelection(current => ({ ...current, id: `feed-${crypto.randomUUID()}` })); }
              }}><span aria-hidden="true">{existing ? "✓" : "+"}</span>{existing ? copy.updateOnHome : copy.addToHome}</button>
          </div>
          <p className="hub-library__status" role="status">{full && !existing ? copy.max : status}</p>
        </div>
      </div>
    </div>
    </dialog>
  </section>;
}
