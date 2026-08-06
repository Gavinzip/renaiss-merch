import { useCallback, useEffect, useRef, useState } from 'react';
import { MerchLanding } from './components/MerchLanding/MerchLanding';
import { MerchStore } from './components/MerchStore/MerchStore';
import { StoreAccessResult } from './components/MerchStore/StoreAccessResult';
import { QualifiedResult } from './components/QualifiedResult/QualifiedResult';
import type {
  EligibleMerchEligibilityResult,
  MerchEligibilityResult
} from './lib/merchEligibility';
import { publicRevealMediaRelease } from './lib/publicRevealMedia';
import { startRenaissLogin } from './lib/renaissAuth';
import { createStoreRevealMediaController } from './lib/storeRevealMedia';
import { preloadStoreAssets } from './lib/storePreload';

const STORE_ADMISSION_QUERY = 'storeAdmission';
const STORE_ADMISSION_SESSION_KEY = 'renaiss-merch-store-admitted';

const previewQualifiedResult: EligibleMerchEligibilityResult = {
  minimumSbtBalance: 40,
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
    claimName: 'Renaiss Bracelet',
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
  const [entryContext] = useState(consumeStoreEntryContext);
  const [view, setView] = useState<AppView>(() =>
    entryContext.shouldResumeStore ? 'store' : 'landing'
  );
  const [storeLoadProgress, setStoreLoadProgress] = useState(0);
  const [storeLoadState, setStoreLoadState] =
    useState<StoreLoadState>('loading');
  const [storeAuthFailed, setStoreAuthFailed] = useState(
    entryContext.authFailed
  );
  const storeEntryAdmittedRef = useRef(entryContext.shouldResumeStore);
  const storeAdmissionInFlightRef = useRef(false);
  const storePreparationInFlightRef =
    useRef<Promise<void> | null>(null);
  const storeImagesReadyRef = useRef(false);
  const revealMediaControllerRef = useRef<ReturnType<
    typeof createStoreRevealMediaController
  > | null>(null);

  if (!revealMediaControllerRef.current) {
    revealMediaControllerRef.current = createStoreRevealMediaController();
  }

  const revealMediaController = revealMediaControllerRef.current;

  const prepareStoreAssets = useCallback(async () => {
    if (
      storeImagesReadyRef.current &&
      revealMediaController.isAdmissionComplete()
    ) {
      setStoreLoadProgress(100);
      return;
    }

    const inFlight = storePreparationInFlightRef.current;

    if (inFlight) {
      await inFlight;
      return;
    }

    let imageProgress = storeImagesReadyRef.current ? 100 : 0;
    let revealProgress = revealMediaController.isAdmissionComplete()
      ? 100
      : 0;

    function updateProgress() {
      setStoreLoadProgress(
        Math.min(
          99,
          Math.round(imageProgress * 0.02 + revealProgress * 0.98)
        )
      );
    }

    const preparation = Promise.all([
      storeImagesReadyRef.current
        ? Promise.resolve()
        : preloadStoreAssets((progress) => {
            imageProgress = progress;
            updateProgress();
          }).then(() => {
            storeImagesReadyRef.current = true;
          }),
      revealMediaController.isAdmissionComplete()
        ? Promise.resolve()
        : revealMediaController.prepareAll((progress) => {
            revealProgress = progress.percent;
            updateProgress();
          })
    ]).then(() => {
      setStoreLoadProgress(100);
    });
    storePreparationInFlightRef.current = preparation;

    try {
      await preparation;
    } finally {
      if (storePreparationInFlightRef.current === preparation) {
        storePreparationInFlightRef.current = null;
      }
    }
  }, [revealMediaController]);

  const enterStore = useCallback(async () => {
    if (storeAdmissionInFlightRef.current) {
      return;
    }

    storeAdmissionInFlightRef.current = true;
    forceLandingLocation();
    setView('landing');
    setStoreLoadProgress(0);
    setStoreLoadState('loading');

    try {
      await prepareStoreAssets();

      storeEntryAdmittedRef.current = true;
      rememberStoreAdmission();
      navigateToView('store', setView);
      setStoreLoadState('idle');
    } catch {
      setStoreLoadState('error');
    } finally {
      storeAdmissionInFlightRef.current = false;
    }
  }, [prepareStoreAssets]);

  const invalidateStoreAdmission = useCallback(() => {
    storeEntryAdmittedRef.current = false;
    forgetStoreAdmission();
    revealMediaController.releaseAll();
    forceLandingLocation();
    setView('landing');
    setStoreLoadProgress(0);
    setStoreLoadState('idle');
  }, [revealMediaController]);

  useEffect(() => {
    let cancelled = false;
    const isLanding = view === 'landing';

    if (isLanding) {
      setStoreLoadState('loading');
    }

    void prepareStoreAssets()
      .then(() => {
        if (cancelled || !isLanding) {
          return;
        }

        setStoreLoadState('idle');
      })
      .catch(() => {
        if (!cancelled && isLanding) {
          setStoreLoadState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [prepareStoreAssets, view]);

  useEffect(() => {
    function syncView() {
      const requestedView = readViewFromLocation();

      if (
        requestedView === 'store' &&
        !storeEntryAdmittedRef.current
      ) {
        forceLandingLocation();
        setView('landing');
        return;
      }

      setView(requestedView);
    }

    window.addEventListener('hashchange', syncView);
    window.addEventListener('popstate', syncView);

    return () => {
      window.removeEventListener('hashchange', syncView);
      window.removeEventListener('popstate', syncView);
    };
  }, [revealMediaController]);

  useEffect(() => {
    if (entryContext.shouldResumeStore) {
      setStoreAuthFailed(entryContext.authFailed);
    }
  }, [
    entryContext.authFailed,
    entryContext.shouldResumeStore
  ]);

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
    return (
      <MerchStore
        initialAuthFailed={storeAuthFailed}
        onAuthenticatedSession={prepareStoreAssets}
        onExitStore={invalidateStoreAdmission}
        onLogin={() => startRenaissLogin(buildStoreAdmissionReturnTo())}
        revealMediaController={revealMediaController}
      />
    );
  }

  return (
    <MerchLanding
      loadProgress={storeLoadProgress}
      loadState={storeLoadState}
      onEnterStore={() => {
        setStoreAuthFailed(false);
        void enterStore();
      }}
      onRetry={() => void enterStore()}
    />
  );
}

type AppView = 'landing' | 'store';
type StoreLoadState = 'idle' | 'loading' | 'error';

type StoreEntryContext = {
  authFailed: boolean;
  shouldResumeStore: boolean;
};

function readViewFromLocation(): AppView {
  return window.location.hash === '#store' ||
    window.location.hash === '#fulfillment'
    ? 'store'
    : 'landing';
}

function consumeStoreEntryContext(): StoreEntryContext {
  const url = new URL(window.location.href);
  const authState = url.searchParams.get('auth');
  const hasAdmissionIntent =
    url.searchParams.get(STORE_ADMISSION_QUERY) === '1';
  const protectedViewRequested = readViewFromLocation() === 'store';
  const hasStoredAdmission = readStoredStoreAdmission();
  const authFailed = hasAdmissionIntent && authState === 'error';
  const shouldResumeStore =
    hasStoredAdmission &&
    (hasAdmissionIntent || protectedViewRequested);

  url.searchParams.delete(STORE_ADMISSION_QUERY);
  url.searchParams.delete('auth');
  url.searchParams.delete('reason');

  if (shouldResumeStore) {
    url.hash = 'store';
  } else if (protectedViewRequested) {
    url.hash = '';
  }

  window.history.replaceState(
    null,
    '',
    `${url.pathname}${url.search}${url.hash}`
  );

  return {
    authFailed,
    shouldResumeStore
  };
}

function readStoredStoreAdmission() {
  try {
    return (
      window.sessionStorage.getItem(STORE_ADMISSION_SESSION_KEY) ===
      publicRevealMediaRelease
    );
  } catch {
    return false;
  }
}

function rememberStoreAdmission() {
  window.sessionStorage.setItem(
    STORE_ADMISSION_SESSION_KEY,
    publicRevealMediaRelease
  );
}

function forgetStoreAdmission() {
  window.sessionStorage.removeItem(STORE_ADMISSION_SESSION_KEY);
}

function buildStoreAdmissionReturnTo() {
  const url = new URL(window.location.href);

  url.hash = '';
  url.searchParams.delete('auth');
  url.searchParams.delete('reason');
  url.searchParams.set(STORE_ADMISSION_QUERY, '1');

  return `${url.pathname}${url.search}`;
}

function forceLandingLocation() {
  const url = new URL(window.location.href);

  if (!url.hash) {
    return;
  }

  url.hash = '';
  window.history.replaceState(
    null,
    '',
    `${url.pathname}${url.search}`
  );
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function navigateToView(
  nextView: AppView,
  setView: (view: AppView) => void,
  replace = false
) {
  const hash = nextView === 'store' ? '#store' : '';
  const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;

  if (replace) {
    window.history.replaceState(null, '', nextUrl);
  } else {
    window.history.pushState(null, '', nextUrl);
  }
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
