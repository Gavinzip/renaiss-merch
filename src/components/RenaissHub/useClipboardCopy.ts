import { useEffect, useRef, useState } from "react";

export function useClipboardCopy() {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (state !== "copied") return;
    const timer = window.setTimeout(() => setState("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);
  async function copy(text: string) {
    setState("copying");
    try { await navigator.clipboard.writeText(text); if (mounted.current) setState("copied"); }
    catch { if (mounted.current) setState("error"); }
  }
  return { state, copy };
}
