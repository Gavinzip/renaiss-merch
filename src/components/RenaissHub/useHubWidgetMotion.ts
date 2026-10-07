import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { HubWidget } from "../../../shared/hub-preferences.js";

type WidgetRect = { x: number; y: number; width: number; height: number };

function rectOf(element: HTMLElement): WidgetRect {
  const rect = element.getBoundingClientRect();
  return { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
}

/** FLIP owns the outer frame; CSS owns the inner card's edit-mode jiggle. */
export function useHubWidgetMotion(widgets: HubWidget[], editing: boolean) {
  const gridRef = useRef<HTMLElement>(null);
  const previous = useRef<Map<string, WidgetRect> | null>(null);
  const animations = useRef(new Set<Animation>());
  const [revision, setRevision] = useState(0);
  const [paused, setPaused] = useState(document.hidden);

  function cancelMotion() {
    animations.current.forEach((animation) => animation.cancel());
    animations.current.clear();
  }

  function captureLayout() {
    previous.current = new Map(
      [...(gridRef.current?.querySelectorAll<HTMLElement>("[data-widget-id]") || [])]
        .map((element) => [element.dataset.widgetId!, rectOf(
          element.dataset.dragging === "true"
            ? element.querySelector<HTMLElement>(".hub-widget__body")!
            : element,
        )]),
    );
  }

  function settleLayout() {
    captureLayout();
    setRevision((value) => value + 1);
  }

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    function updateMotion() {
      setPaused(document.hidden);
      if (document.hidden || media.matches) cancelMotion();
    }
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateMotion);
    return () => {
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateMotion);
      cancelMotion();
    };
  }, []);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = null;
    if (!before) return;
    // Capture occurs before cancellation, so rapid moves start from the card's
    // current visible position instead of jumping to its previous destination.
    cancelMotion();
    if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gridRef.current?.querySelectorAll<HTMLElement>("[data-widget-id]").forEach((element) => {
      if (element.dataset.dragging === "true") return;
      const old = before.get(element.dataset.widgetId!);
      const next = rectOf(element);
      const dx = old ? old.x - next.x : 0;
      const dy = old ? old.y - next.y : 0;
      if (old && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(old.width - next.width) < 0.5 && Math.abs(old.height - next.height) < 0.5) return;
      const overshoot = (distance: number) => Math.max(-8, Math.min(8, distance * -0.025));
      const frames: Keyframe[] = old ? [
        { transform: `translate(${dx}px, ${dy}px) scale(${old.width / next.width}, ${old.height / next.height})`, offset: 0 },
        { transform: `translate(${overshoot(dx)}px, ${overshoot(dy)}px) scale(1.005)`, offset: 0.72 },
        { transform: "translate(0, 0) scale(.999)", offset: 0.9 },
        { transform: "none", offset: 1 },
      ] : [
        { transform: "translateY(12px) scale(.955)", opacity: 0.35, offset: 0 },
        { transform: "translateY(-3px) scale(1.012)", opacity: 1, offset: 0.66 },
        { transform: "translateY(1px) scale(.997)", opacity: 1, offset: 0.88 },
        { transform: "none", opacity: 1, offset: 1 },
      ];
      const animation = element.animate(frames, { duration: 480, easing: "cubic-bezier(.22,1,.36,1)" });
      animations.current.add(animation);
      const release = () => animations.current.delete(animation);
      animation.addEventListener("finish", release, { once: true });
      animation.addEventListener("cancel", release, { once: true });
    });
  }, [widgets, editing, revision]);

  return { gridRef, captureLayout, settleLayout, cancelMotion, paused };
}
