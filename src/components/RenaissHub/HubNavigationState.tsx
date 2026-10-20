import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

const NavigationState = createContext<{
  collapsed: boolean;
  toggle: () => void;
  busy: boolean;
} | null>(null);

// This owner stays mounted while Hub, campaign, archive and Store pages switch.
export function HubNavigationProvider({ children, busy }: { children: ReactNode; busy: boolean }) {
  const [collapsed, setCollapsed] = useState(true);
  const value = useMemo(() => ({
    collapsed,
    busy,
    toggle: () => setCollapsed(current => !current),
  }), [collapsed, busy]);
  return <NavigationState.Provider value={value}>{children}</NavigationState.Provider>;
}

export function useHubNavigationState() {
  const state = useContext(NavigationState);
  if (!state) throw new Error('Hub navigation requires HubNavigationProvider.');
  return state;
}
