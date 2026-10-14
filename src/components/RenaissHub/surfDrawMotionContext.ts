import { createContext, useContext } from 'react';
import type { SurfProLogoUrls } from '../SurfStoreRewards/prepareSurfProLogos';
import type { SurfDrawMediaState } from './surfDrawMedia';

type Assets = {
  box: SurfDrawMediaState; card: SurfDrawMediaState;
  images?: ImageBitmap[]; logos?: SurfProLogoUrls; retry: () => void;
};

// Keep context identity stable when the asset provider receives a hot update.
export const SurfDrawMotionContext = createContext<Assets | null>(null);

export function useSurfDrawMotionAssets() {
  const assets = useContext(SurfDrawMotionContext);
  if (!assets) throw new Error('surf_draw_motion_assets_provider_missing');
  return assets;
}
