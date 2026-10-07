import { useEffect, useRef, useState } from 'react';

// Playback timing is runtime behavior, independent of async presentation CSS.
const eventCarouselIntervalMs = 6_000;

export function useHubEventCarousel(ids: string[], enabled: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(ids[0]);
  const [settled, setSettled] = useState<Set<string>>(() => new Set());
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const index = Math.max(0, ids.indexOf(selected));
  const active = ids[index];
  const next = ids[(index + 1) % ids.length];
  const order = ids.join('|');
  const playing = enabled && ids.length > 1 && !hovered && !focused && visible && pageVisible && !reduced;

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .1 });
    observer.observe(element);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media.matches);
    const visibility = () => setPageVisible(!document.hidden);
    media.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', motion);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  useEffect(() => {
    if (!playing || !settled.has(active) || !settled.has(next) || !root.current) return;
    const timer = window.setTimeout(() => setSelected(next), eventCarouselIntervalMs);
    return () => window.clearTimeout(timer);
  }, [playing, active, next, settled, order]);

  function markSettled(id: string) {
    setSettled(current => current.has(id) ? current : new Set([...current, id]));
  }
  function move(offset: number) {
    setSelected(ids[(index + offset + ids.length) % ids.length]);
  }
  return { root, index, active, playing, setHovered, setFocused, move, select: setSelected, markSettled };
}
