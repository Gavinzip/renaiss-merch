import { useCallback, useEffect, useRef, useState } from "react";
import { registerLocationGuard } from "../../lib/navigationGuards";

export function useBinderRoute(message: string) {
  const [active, setActive] = useState(() => location.hash === "#binder");
  const current = useRef(active),
    dirty = useRef(false),
    prompt = useRef(message);
  prompt.current = message;
  useEffect(() => {
    const unregister = registerLocationGuard(() => {
      if (location.hash !== "#binder" && current.current && dirty.current) {
        if (!confirm(prompt.current)) {
          history.replaceState(
            history.state,
            "",
            location.pathname + location.search + "#binder",
          );
          return false;
        }
        dirty.current = false;
      }
      return true;
    });
    const sync = () => {
      current.current = location.hash === "#binder";
      setActive(current.current);
    };
    addEventListener("hashchange", sync);
    addEventListener("popstate", sync);
    return () => {
      unregister();
      removeEventListener("hashchange", sync);
      removeEventListener("popstate", sync);
    };
  }, []);
  const onDirtyChange = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  return {
    active,
    onDirtyChange,
    open: () => {
      location.hash = "#binder";
    },
    guard(action: () => void) {
      if (dirty.current && !confirm(prompt.current)) return;
      // Async actions such as logout and Store preparation may fail. Keep the
      // actual dirty flag until the draft is saved or its page really unmounts.
      action();
    },
  };
}
