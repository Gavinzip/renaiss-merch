// The unpublished home is reachable directly, without changing the public entry.
export const hiddenHubPath = '/next/';

export function isHiddenHubPath(pathname) {
  return pathname === '/next' || pathname.startsWith(hiddenHubPath);
}
