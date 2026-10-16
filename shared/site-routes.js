// Keep the former review URL as a direct, noindex alias for existing links.
export const hiddenHubPath = '/next/';
export const drawSitePath = '/draw/';

export function isDrawSitePath(pathname) {
  return pathname === '/draw' || pathname === drawSitePath || pathname === '/draw/index.html';
}

export function isHiddenHubPath(pathname) {
  return pathname === '/next' || pathname.startsWith(hiddenHubPath);
}
