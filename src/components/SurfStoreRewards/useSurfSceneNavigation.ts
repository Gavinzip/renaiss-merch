import { useEffect } from 'react';

export function useSurfSceneNavigation(onBack: () => void) {
  useEffect(() => {
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') onBack(); }
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onBack]);
  return onBack;
}
