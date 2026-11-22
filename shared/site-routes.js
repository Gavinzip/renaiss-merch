// Keep the former review URL as a direct, noindex alias for existing links.
export const hiddenHubPath = '/next/';
export const drawSitePath = '/draw/';

export function isDrawSitePath(pathname) {
  return pathname === '/draw' || pathname === drawSitePath || pathname === '/draw/index.html';
}

export function isHiddenHubPath(pathname) {
  return pathname === '/next' || pathname.startsWith(hiddenHubPath);
}

export function isFieldDrawSitePath(pathname) {
  return pathname === '/field-draw' || pathname === '/field-draw/' || pathname === '/field-draw/index.html' || isFieldDrawRosterPath(pathname);
}

export function isFieldDrawRosterPath(pathname) {
  return pathname === '/field-draw/roster' || pathname === '/field-draw/roster/';
}
