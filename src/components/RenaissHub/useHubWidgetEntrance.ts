import { useLayoutEffect, useRef, type RefObject } from 'react';
import { playHubWidgetEntrance } from './hubWidgetEntrance';
import './HubWidgetEntrance.css';

export function useHubWidgetEntrance(grid: RefObject<HTMLElement | null>, ready: boolean, active: boolean, editing: boolean) {
  const cancel = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    if (!ready || !active || !grid.current) return;
    cancel.current = playHubWidgetEntrance(grid.current);
    return () => { cancel.current?.(); cancel.current = null; };
  }, [grid, ready, active]);

  // Editing cancels the entrance but leaving the editor never replays it.
  useLayoutEffect(() => { if (editing) cancel.current?.(); }, [editing]);
}
