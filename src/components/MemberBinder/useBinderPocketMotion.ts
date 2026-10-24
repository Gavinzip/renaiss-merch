import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PocketTarget } from "./BinderBook";

export const pocketKey = (target: PocketTarget) => `${target.page}:${target.pocket}`;

// Keep the real item in its pocket until the reference's 300 ms lift finishes.
// The callback ref ensures a delayed removal edits the latest collection.
export function useBinderPocketMotion(onRemove: (target: PocketTarget, expectedToken: string) => void) {
  const removeRef = useRef(onRemove);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  useLayoutEffect(() => { removeRef.current = onRemove; }, [onRemove]);
  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
  }, []);
  function remove(target: PocketTarget, expectedToken: string) {
    const key = pocketKey(target);
    if (timers.current.has(key)) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      removeRef.current(target, expectedToken);
      return;
    }
    setLeaving((previous) => new Set(previous).add(key));
    timers.current.set(key, setTimeout(() => {
      timers.current.delete(key);
      removeRef.current(target, expectedToken);
      setLeaving((previous) => {
        const next = new Set(previous);
        next.delete(key);
        return next;
      });
    }, 300));
  }
  return { leaving, remove };
}
