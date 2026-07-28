import { useEffect, useState } from 'react';
import { MerchLanding } from './components/MerchLanding/MerchLanding';
import { MerchStore } from './components/MerchStore/MerchStore';
import { StoreAccessResult } from './components/MerchStore/StoreAccessResult';
import { QualifiedResult } from './components/QualifiedResult/QualifiedResult';
import type {
  EligibleMerchEligibilityResult,
  MerchEligibilityResult
} from './lib/merchEligibility';

const previewQualifiedResult: EligibleMerchEligibilityResult = {
  minimumSbtBalance: 60,
  reveal: {
    category: 'Apparel',
    claimName: 'Renaiss Tee',
    description: 'A private Renaiss edition with worldwide fulfilment.',
    hasReverseVideo: true,
    requiresSize: true,
    statusEyebrow: 'RENAISS MERCH'
  },
  sbtBadgeCount: 88,
  sbtBalance: 88,
  status: 'eligible',
  walletAddress: '0x1111111111111111111111111111111111111111'
};

const previewBraceletResult: MerchEligibilityResult = {
  minimumSbtBalance: 100,
  reveal: {
    category: 'Object',
    claimName: 'RENAISS Bracelet',
    description: 'A private Renaiss object edition with a polished finish.',
    hasReverseVideo: true,
    requiresSize: false,
    statusEyebrow: 'RENAISS OBJECT / DROP 02'
  },
  sbtBadgeCount: 112,
  sbtBalance: 112,
  status: 'eligible',
  walletAddress: '0x2222222222222222222222222222222222222222'
};

export default function App() {
  const [view, setView] = useState(readViewFromLocation);

  useEffect(() => {
    function syncView() {
      setView(readViewFromLocation());
    }

    window.addEventListener('hashchange', syncView);
    window.addEventListener('popstate', syncView);

    return () => {
      window.removeEventListener('hashchange', syncView);
      window.removeEventListener('popstate', syncView);
    };
  }, []);

  if (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('preview') === 'qualified'
  ) {
    return <QualifiedResult result={previewQualifiedResult} />;
  }

  if (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('preview') ===
      'bracelet-reveal'
  ) {
    return (
      <StoreAccessResult
        onBack={() => navigateToPreviewStore(setView)}
        productId="bracelet"
        result={previewBraceletResult}
      />
    );
  }

  if (view === 'store') {
    return <MerchStore onExitStore={() => navigateToView('landing', setView)} />;
  }

  return <MerchLanding onEnterStore={() => navigateToView('store', setView)} />;
}

type AppView = 'landing' | 'store';

function readViewFromLocation(): AppView {
  return window.location.hash === '#store' ||
    window.location.hash === '#fulfillment'
    ? 'store'
    : 'landing';
}

function navigateToView(
  nextView: AppView,
  setView: (view: AppView) => void
) {
  const hash = nextView === 'store' ? '#store' : '';
  const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;

  window.history.pushState(null, '', nextUrl);
  setView(nextView);
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function navigateToPreviewStore(setView: (view: AppView) => void) {
  const url = new URL(window.location.href);
  url.searchParams.delete('preview');
  url.hash = 'store';
  window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
  setView('store');
}
