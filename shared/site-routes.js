// Keep the former review URL as a direct, noindex alias for existing links.
export const hiddenHubPath = '/next/';

export function isHiddenHubPath(pathname) {
  return pathname === '/next' || pathname.startsWith(hiddenHubPath);
}
