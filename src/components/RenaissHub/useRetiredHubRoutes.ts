import { useEffect } from 'react';

// Retire the public surface without touching anyone's stored binder data.
export function useRetiredHubRoutes() {
  useEffect(() => {
    const redirect = () => {
      if (location.hash === '#binder') location.replace('#portal-top');
    };
    redirect();
    window.addEventListener('hashchange', redirect);
    window.addEventListener('popstate', redirect);
    return () => {
      window.removeEventListener('hashchange', redirect);
      window.removeEventListener('popstate', redirect);
    };
  }, []);
}
