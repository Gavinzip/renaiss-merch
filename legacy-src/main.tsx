import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyStaticMerchFavicon } from '../src/lib/staticAssets';
import './styles/global.css';

applyStaticMerchFavicon();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
