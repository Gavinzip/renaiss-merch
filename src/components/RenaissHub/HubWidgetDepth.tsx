import type { ReactNode } from 'react';

// Static glass material. Route entry, editor jiggle and grid FLIP retain their
// own elements; ordinary pointer movement never moves the card.
export function HubWidgetDepth({ children }: { children: ReactNode }) {
  return <div className="hub-widget__depth">
    <div className="hub-widget__material">{children}</div>
  </div>;
}
