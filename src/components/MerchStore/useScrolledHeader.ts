import { useEffect, useState } from 'react';

const HEADER_REVEAL_SCROLL_PX = 24;

export function useScrolledHeader(enabled: boolean) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsScrolled(false);
      return undefined;
    }

    function syncHeaderState() {
      setIsScrolled(window.scrollY > HEADER_REVEAL_SCROLL_PX);
    }

    syncHeaderState();
    window.addEventListener('scroll', syncHeaderState, { passive: true });

    return () => {
      window.removeEventListener('scroll', syncHeaderState);
    };
  }, [enabled]);

  return isScrolled;
}
