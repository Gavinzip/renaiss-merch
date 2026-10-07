import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { HubWidget } from "../../../shared/hub-preferences.js";

export type HubWidgetDrag = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

type Press = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  grabX: number;
  grabY: number;
  width: number;
  height: number;
  order: string[];
  lastTarget: string | null;
  lastX: number;
  lastY: number;
};

export function useHubWidgetDrag({
  gridRef, widgets, editing, onReorder, onRestoreOrder, onSettle, onPickUp,
}: {
  gridRef: RefObject<HTMLElement | null>;
  widgets: HubWidget[];
  editing: boolean;
  onReorder: (id: string, target: string) => void;
  onRestoreOrder: (ids: string[]) => void;
  onSettle: () => void;
  onPickUp: () => void;
}) {
  const [drag, setDrag] = useState<HubWidgetDrag | null>(null);
  const press = useRef<Press | null>(null);
  const dragging = useRef(false);
  const frame = useRef<number | null>(null);
  const callbacks = useRef({ onReorder, onRestoreOrder, onSettle });
  useLayoutEffect(() => { callbacks.current = { onReorder, onRestoreOrder, onSettle }; });

  function stop(cancel = false) {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const current = press.current;
    const wasDragging = dragging.current;
    press.current = null;
    dragging.current = false;
    if (current && gridRef.current?.hasPointerCapture(current.pointerId)) {
      gridRef.current.releasePointerCapture(current.pointerId);
    }
    if (current && wasDragging) {
      callbacks.current.onSettle();
      if (cancel) callbacks.current.onRestoreOrder(current.order);
    }
    setDrag(null);
  }

  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && press.current) { event.preventDefault(); stop(true); }
    }
    function hidden() { if (document.hidden) stop(true); }
    document.addEventListener("keydown", escape);
    document.addEventListener("visibilitychange", hidden);
    const blur = () => stop(true);
    window.addEventListener("blur", blur);
    window.addEventListener("resize", blur);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", blur);
      window.removeEventListener("resize", blur);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      const current = press.current;
      press.current = null;
      dragging.current = false;
      if (current && gridRef.current?.hasPointerCapture(current.pointerId)) gridRef.current.releasePointerCapture(current.pointerId);
    };
  }, []);

  useEffect(() => { if (!editing && press.current) stop(true); }, [editing]);

  function updatePosition() {
    const current = press.current;
    const grid = gridRef.current;
    if (!current || !grid || !dragging.current) return;
    const left = current.x - current.grabX;
    const top = current.y - current.grabY;
    setDrag({ id: current.id, left, top, width: current.width, height: current.height });

    const origin = grid.getBoundingClientRect();
    const center = { x: left + current.width / 2, y: top + current.height / 2 };
    // Layout offsets ignore other cards' in-flight FLIP transforms. Hit testing
    // follows their intended slots, rather than chasing moving visual bounds.
    const slots = [...grid.querySelectorAll<HTMLElement>("[data-widget-id]")].map((element) => ({
      id: element.dataset.widgetId!,
      left: origin.left + element.offsetLeft,
      top: origin.top + element.offsetTop,
      width: element.offsetWidth,
      height: element.offsetHeight,
    }));
    const inside = (slot: typeof slots[number]) => center.x >= slot.left && center.x <= slot.left + slot.width && center.y >= slot.top && center.y <= slot.top + slot.height;
    const activeSlot = slots.find((slot) => slot.id === current.id);
    if (activeSlot && inside(activeSlot)) return;
    const target = slots.filter((slot) => slot.id !== current.id).sort((a, b) => {
      const distance = (slot: typeof slots[number]) => Math.hypot(center.x - slot.left - slot.width / 2, center.y - slot.top - slot.height / 2);
      return distance(a) - distance(b);
    })[0];
    if (!target || !inside(target)) return;
    // Unequal grid spans can put the same neighbour under the pointer again
    // after reflow. Require deliberate travel before reversing that swap.
    if (target.id === current.lastTarget && Math.hypot(current.x - current.lastX, current.y - current.lastY) < 48) return;
    current.lastTarget = target.id;
    current.lastX = current.x;
    current.lastY = current.y;
    callbacks.current.onReorder(current.id, target.id);
  }

  function autoScroll() {
    const current = press.current;
    if (!current || !dragging.current) return;
    const edge = 72;
    const speed = current.y < edge ? -Math.min(12, (edge - current.y) / 5) : current.y > innerHeight - edge ? Math.min(12, (current.y - innerHeight + edge) / 5) : 0;
    if (speed) {
      const before = window.scrollY;
      window.scrollBy(0, speed);
      if (window.scrollY !== before) updatePosition();
    }
    frame.current = requestAnimationFrame(autoScroll);
  }

  function start(id: string, event: ReactPointerEvent, handle = false) {
    if (!editing || event.button !== 0 || !event.isPrimary || press.current) return;
    if (!handle && (event.pointerType !== "mouse" || (event.target as Element).closest("a,button,input,select,textarea,summary,[role=button]"))) return;
    onPickUp();
    const element = [...(gridRef.current?.querySelectorAll<HTMLElement>("[data-widget-id]") || [])].find((item) => item.dataset.widgetId === id);
    if (!element || !gridRef.current) return;
    const rect = element.getBoundingClientRect();
    press.current = {
      id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, grabX: event.clientX - rect.left, grabY: event.clientY - rect.top,
      width: rect.width, height: rect.height, order: widgets.map((widget) => widget.id),
      lastTarget: null, lastX: event.clientX, lastY: event.clientY,
    };
    gridRef.current.setPointerCapture(event.pointerId);
  }

  function move(event: ReactPointerEvent) {
    const current = press.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.x = event.clientX;
    current.y = event.clientY;
    if (!dragging.current) {
      if (Math.hypot(current.x - current.startX, current.y - current.startY) < 6) return;
      dragging.current = true;
      frame.current = requestAnimationFrame(autoScroll);
    }
    event.preventDefault();
    updatePosition();
  }

  return { drag, start, move, end: () => stop(), cancel: () => stop(true) };
}
