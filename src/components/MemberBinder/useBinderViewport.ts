import { useLayoutEffect, type RefObject } from "react";

/** Keep the canvas on Safari's current layout viewport during display handoff. */
export function useBinderViewport(
  root: RefObject<HTMLElement | null>,
  active: boolean,
) {
  useLayoutEffect(() => {
    const canvas = root.current;
    if (!active || !canvas) return;
    const previousWidth = canvas.style.width;
    const previousHeight = canvas.style.height;
    const sync = () => {
      // Safari can dispatch resize before fixed insets and viewport units catch
      // up. Apply both axes in this event, without an extra animation frame.
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    sync();
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      canvas.style.width = previousWidth;
      canvas.style.height = previousHeight;
    };
  }, [root, active]);
}
