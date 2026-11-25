import { useEffect, useState } from 'react';

export type ArchiveEventId = 'football' | 'pokemon-30' | 'surf' | 'worlds-2026' | 'bbw';
export type ArchiveRoute = 'index' | ArchiveEventId | `${ArchiveEventId}/winners` | null;

function readArchiveRoute(): ArchiveRoute {
  switch (window.location.hash) {
    case '#events': return 'index';
    case '#events/football': return 'football';
    case '#events/pokemon-30': return 'pokemon-30';
    case '#events/surf': return 'surf';
    case '#events/worlds-2026': return 'worlds-2026';
    case '#events/bbw': return 'bbw';
    case '#events/football/winners': return 'football/winners';
    case '#events/pokemon-30/winners': return 'pokemon-30/winners';
    case '#events/surf/winners': return 'surf/winners';
    case '#events/worlds-2026/winners': return 'worlds-2026/winners';
    case '#events/bbw/winners': return 'bbw/winners';
    default: return null;
  }
}

export function useHubArchiveRoute() {
  const [route, setRoute] = useState(readArchiveRoute);
  useEffect(() => {
    const sync = () => setRoute(readArchiveRoute());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);
  return { route, open: () => { window.location.hash = '#events'; } };
}
