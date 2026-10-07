import { useEffect, useRef, useState } from "react";

// Native dialog owns focus trapping, background inertness and focus return.
// React owns the opening/closing phases; close timing comes from recipe 06.
export function useAssistantDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const [phase, setPhase] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const visible = phase !== "closed";
  useEffect(() => {
    if (!visible) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const viewport = window.visualViewport;
    function resize() { ref.current?.style.setProperty("--assistant-viewport-height", `${viewport?.height ?? window.innerHeight}px`); }
    resize();
    viewport?.addEventListener("resize", resize);
    return () => { document.body.style.overflow = overflow; viewport?.removeEventListener("resize", resize); };
  }, [visible]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (phase === "opening") {
      if (!dialog.open) dialog.showModal();
      const initialFocus = matchMedia("(max-width: 560px)").matches ? dialog.querySelector<HTMLElement>("h2") : dialog.querySelector<HTMLElement>("textarea");
      initialFocus?.focus({ preventScroll: true });
      // Commit the resting recipe state before animating to .is-open.
      void dialog.offsetWidth;
      const frame = requestAnimationFrame(() => setPhase("open"));
      return () => cancelAnimationFrame(frame);
    }
    if (phase === "closing") {
      const styles = getComputedStyle(dialog);
      const seconds = styles.getPropertyValue("--modal-close-dur").trim();
      const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : parseFloat(seconds) * (seconds.endsWith("ms") ? 1 : 1000);
      const timer = window.setTimeout(() => { dialog.close(); setPhase("closed"); }, duration);
      return () => window.clearTimeout(timer);
    }
  }, [phase]);
  useEffect(() => { const dialog = ref.current; return () => { dialog?.close(); }; }, []);
  return { ref, phase, visible, open: () => setPhase("opening"), close: () => setPhase(current => current === "closed" ? current : "closing") };
}
