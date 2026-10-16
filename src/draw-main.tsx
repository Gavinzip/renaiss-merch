import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LocaleProvider } from './i18n/LocaleContext';
import { applyStaticMerchFavicon } from './lib/staticAssets';
import { DrawSiteApp } from './components/DrawRoom/DrawSiteApp';
import './styles/global.css';
import './components/DrawRoom/DrawSite.css';
import './components/DrawRoom/DrawControls.css';

applyStaticMerchFavicon();

createRoot(document.getElementById('root')!).render(
  <StrictMode><LocaleProvider><DrawSiteApp /></LocaleProvider></StrictMode>,
);
