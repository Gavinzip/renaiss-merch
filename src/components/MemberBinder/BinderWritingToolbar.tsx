import { Check, Eraser, PenLine, Type, Undo2 } from "lucide-react";
import { BINDER_INK_COLORS } from "../../../shared/binder-writing.js";
import type { BinderWritingController } from "./useBinderWriting";
import type { BinderWritingCopy } from "./binderWritingCopy";
import "./BinderWriting.css";

export function BinderWritingToolbar({
  ink,
  copy,
  disabled,
}: {
  ink: BinderWritingController;
  copy: BinderWritingCopy;
  disabled: boolean;
}) {
  if (ink.tool === "read")
    return (
      <div className="binder-writing-dock">
        <button
          type="button"
          className="binder-write-start"
          onClick={() => ink.setTool("pen")}
          disabled={disabled}
        >
          <PenLine size={15} />
          {copy.write}
        </button>
      </div>
    );
  return (
    <div className="binder-writing-dock">
      <div
        className="binder-writing-toolbar"
        role="toolbar"
        aria-label={copy.write}
      >
        {(
          [
            { tool: "pen", icon: PenLine, label: copy.pen },
            { tool: "text", icon: Type, label: copy.text },
            { tool: "erase", icon: Eraser, label: copy.erase },
          ] as const
        ).map(({ tool, icon: Icon, label }) => (
          <button
            type="button"
            key={tool}
            title={label}
            aria-label={label}
            aria-pressed={ink.tool === tool}
            disabled={ink.busy}
            onClick={() => ink.setTool(tool)}
          >
            <Icon size={17} />
          </button>
        ))}
        <span
          className="binder-ink-colors"
          role="group"
          aria-label={copy.color}
        >
          {BINDER_INK_COLORS.map((color, i) => (
            <button
              type="button"
              key={color}
              aria-label={copy.colors[i]}
              aria-pressed={ink.color === color}
              disabled={ink.busy}
              onClick={() => ink.setColor(color)}
              style={{ "--ink-color": color } as React.CSSProperties}
            />
          ))}
        </span>
        <button
          type="button"
          className="binder-ink-size"
          aria-label={`${copy.size}: ${copy.sizes[ink.size]}`}
          title={copy.size}
          disabled={ink.busy}
          onClick={() => ink.setSize((ink.size + 1) % 3)}
        >
          <i style={{ width: 4 + ink.size * 3, height: 4 + ink.size * 3 }} />
        </button>
        <button
          type="button"
          title={copy.undo}
          aria-label={copy.undo}
          disabled={ink.busy || !ink.canUndo}
          onClick={() => ink.undo()}
        >
          <Undo2 size={17} />
        </button>
        <button
          type="button"
          title={copy.done}
          aria-label={copy.done}
          disabled={ink.busy}
          onClick={() => ink.setTool("read")}
        >
          <Check size={18} />
        </button>
      </div>
      {ink.limit ? (
        <p role="alert" className="binder-ink-message">
          {copy.limit}
        </p>
      ) : (
        <p className="binder-ink-message">{copy.note}</p>
      )}
    </div>
  );
}
