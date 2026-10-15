import { useEffect, useState } from 'react';

export const drawRoomHashes = {
  surf: '#draw/surf',
  charizard: '#draw/charizard',
  other: '#draw/other',
  roster: '#draw/roster',
} as const;
export type DrawRoomView = keyof typeof drawRoomHashes;

export function isDrawRoomHash(hash: string) {
  return Object.values(drawRoomHashes).some(value => value === hash);
}

function currentView(): DrawRoomView {
  return (Object.keys(drawRoomHashes) as DrawRoomView[])
    .find(view => drawRoomHashes[view] === window.location.hash) ?? 'surf';
}

export function useDrawRoomRoute() {
  const [view, setView] = useState(currentView);
  useEffect(() => {
    const sync = () => setView(currentView());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);
  return view;
}
