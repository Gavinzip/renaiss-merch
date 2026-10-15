import { useLayoutEffect } from 'react';

// Keep the active ceremony mounted until its saved result has been shown.
// Capture runs before the application's hash routers read the changed URL.
export function useDrawNavigationLock(active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;
    const url = window.location.href;
    const state = window.history.state;
    const retain = () => {
      if (window.location.href !== url) window.history.replaceState(state, '', url);
    };
    window.addEventListener('popstate', retain, true);
    window.addEventListener('hashchange', retain, true);
    return () => {
      window.removeEventListener('popstate', retain, true);
      window.removeEventListener('hashchange', retain, true);
    };
  }, [active]);
}
