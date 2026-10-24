import { useEffect, useRef, useState } from "react";

// Each pocket gets its own 900 ms effect lifetime, even during rapid edits.
export function useBinderPocketInsertions(slots: (string | null)[]) {
  const previous = useRef(slots);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const [added, setAdded] = useState<ReadonlySet<number>>(new Set());
  useEffect(() => {
    slots.forEach((token, index) => {
      if (token === previous.current[index]) return;
      clearTimeout(timers.current.get(index));
      timers.current.delete(index);
      setAdded((value) => {
        const next = new Set(value);
        if (token) next.add(index); else next.delete(index);
        return next;
      });
      if (token) timers.current.set(index, setTimeout(() => {
        timers.current.delete(index);
        setAdded((value) => {
          const next = new Set(value);
          next.delete(index);
          return next;
        });
      }, 900));
    });
    previous.current = slots;
  }, [slots]);
  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
  }, []);
  return added;
}
