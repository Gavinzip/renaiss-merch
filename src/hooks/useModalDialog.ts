import { useEffect, useRef, useState } from "react";

export function useModalDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const [phase, setPhase] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const visible = phase !== "closed";
  useEffect(() => {
    if (!visible) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [visible]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (phase === "opening") {
      if (!dialog.open) dialog.showModal();
      dialog.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
      void dialog.offsetWidth;
      const frame = requestAnimationFrame(() => setPhase("open"));
      return () => cancelAnimationFrame(frame);
    }
    if (phase === "closing") {
      const value = getComputedStyle(dialog).getPropertyValue("--modal-close-dur").trim();
      const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 :
        parseFloat(value) * (value.endsWith("ms") ? 1 : 1000);
      const timer = window.setTimeout(() => { dialog.close(); setPhase("closed"); }, duration);
      return () => clearTimeout(timer);
    }
  }, [phase]);
  useEffect(() => { const dialog = ref.current; return () => { dialog?.close(); }; }, []);
  return { ref, phase, open: () => setPhase("opening"), close: () => setPhase(current => current === "closed" ? current : "closing") };
}
