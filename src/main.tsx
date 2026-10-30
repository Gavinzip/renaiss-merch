import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LocaleProvider } from './i18n/LocaleContext';
import { applyStaticMerchFavicon } from './lib/staticAssets';
import './styles/global.css';
import { HubPageLoading } from './components/RenaissHub/HubPageLoading';

const PublicVerification = lazy(() => import('./components/PublicVerification/PublicVerification'));
const isPublicProof = window.location.pathname === '/verify' || window.location.pathname === '/verify/';

applyStaticMerchFavicon();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <Suspense fallback={<HubPageLoading />}>
        {isPublicProof ? <PublicVerification /> : <App />}
      </Suspense>
    </LocaleProvider>
  </StrictMode>
);
