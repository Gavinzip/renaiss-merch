import type { ReactNode } from "react";
import "./BinderToolsPanel.css";

/** Keep the product header and editing actions together in the visible area.
 * The native popover dismisses on outside tap/Escape and owns focus ordering.
 */
export function BinderToolsPanel({
  id,
  header,
  children,
  onOpenChange,
}: {
  id: string;
  header: ReactNode;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <aside
      id={id}
      popover="auto"
      className="binder-tools-panel"
      onToggle={(event) => {
        if (event.target === event.currentTarget)
          onOpenChange(event.newState === "open");
      }}
    >
      {header}
      <div className="binder-tools-panel__body">{children}</div>
    </aside>
  );
}
