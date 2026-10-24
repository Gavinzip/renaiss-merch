const guards = new Set<() => boolean>();

export function registerLocationGuard(guard: () => boolean) {
  guards.add(guard);
  return () => { guards.delete(guard); };
}

// App invokes guards before committing any route state. Canceled navigation
// restores the URL before the page-level route listeners observe it.
export function approveLocationChange() {
  for (const guard of guards) if (!guard()) return false;
  return true;
}
