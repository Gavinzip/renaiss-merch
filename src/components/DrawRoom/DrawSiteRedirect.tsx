import { useLayoutEffect } from 'react';
import { drawSitePath } from '../../../shared/site-routes.js';

export function DrawSiteRedirect() {
  useLayoutEffect(() => {
    window.location.replace(`${drawSitePath}${window.location.hash}`);
  }, []);
  return null;
}
