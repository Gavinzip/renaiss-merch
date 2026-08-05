import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties
} from 'react';
import renaissLogoMark from '../../assets/renaiss-logo-mark.png';
import { staticMerchAssetCssUrl } from '../../lib/staticAssets';
import {
  createMerchAccessProductState,
  readMerchAccessState,
  type MerchAccessProductState
} from '../../lib/merchAccessState';
import {
  EligibilityPendingError,
  checkMerchEligibility,
  type MerchEligibilityResult
} from '../../lib/merchEligibility';
import {
  readRenaissSession,
  signOutRenaiss,
  startDemoRenaissSession,
  type RenaissSession
} from '../../lib/renaissAuth';
import { type PreparedRevealMedia } from '../../lib/revealMediaPreload';
import {
  StoreRevealMediaCancelledError,
  type StoreRevealMediaController
} from '../../lib/storeRevealMedia';
import { FulfillmentConsole } from '../FulfillmentConsole/FulfillmentConsole';
import { ShippingSettings } from '../ShippingSettings/ShippingSettings';
import { CatalogProductTile } from './CatalogProductTile';
import { MerchProductCard } from './MerchProductCard';
import { merchCatalog, type MerchProductId } from './merchCatalog';
import {
  CATALOG_VIEW_ENABLED,
  readStoredMerchStoreView,
  saveMerchStoreView,
  type MerchStoreView
} from './merchStoreView';
import { StoreAccessResult } from './StoreAccessResult';
import { useScrolledHeader } from './useScrolledHeader';
import '../MerchEligibilityEntry/MerchEligibilityEntry.css';
import './MerchStore.css';

type StoreState =
  | 'loading-session'
  | 'idle'
  | 'auth-required'
  | 'signing-in'
  | 'opening-demo'
  | 'authenticated'
  | 'checking'
  | 'wallet-pending'
  | 'eligibility-pending'
  | 'source-error'
  | 'auth-error';

type AccessResult = {
  productId: MerchProductId;
  revealMedia?: PreparedRevealMedia;
  result: MerchEligibilityResult;
};

type MerchStoreProps = {
  initialAuthFailed: boolean;
  onAuthenticatedSession: () => Promise<void>;
  onExitStore?: () => void;
  onLogin: () => void;
  revealMediaController: StoreRevealMediaController;
};

export function MerchStore({
  initialAuthFailed,
  onAuthenticatedSession,
  onExitStore,
  onLogin,
  revealMediaController
}: MerchStoreProps) {
  const [session, setSession] = useState<RenaissSession>({
    authenticated: false
  });
  const [storeState, setStoreState] =
    useState<StoreState>('loading-session');
  const [selectedProductId, setSelectedProductId] =
    useState<MerchProductId | null>(null);
  const [accessResult, setAccessResult] = useState<AccessResult | null>(null);
  const [productAccess, setProductAccess] = useState<
    Partial<Record<MerchProductId, MerchAccessProductState>>
  >({});
  const [showFulfillment, setShowFulfillment] = useState(
    () => window.location.hash === '#fulfillment'
  );
  const [showSettings, setShowSettings] = useState(false);
  const [storeView, setStoreView] = useState<MerchStoreView>(
    () =>
      CATALOG_VIEW_ENABLED ? readStoredMerchStoreView() : 'cards'
  );
  const isCatalogHeaderScrolled = useScrolledHeader(storeView === 'catalog');

  const user = session.authenticated ? session.user : null;
  const sessionLabel =
    user?.name || user?.email || formatTwitterUsername(user?.twitterUsername);
  const walletLabel = user?.safeWalletAddress
    ? shortenWallet(user.safeWalletAddress)
    : 'Safe wallet pending';
  const isChecking =
    storeState === 'checking';

  const statusText = useMemo(() => {
    switch (storeState) {
      case 'loading-session':
        return 'Checking your Renaiss session.';
      case 'idle':
        return 'Explore the releases, then sign in when you are ready.';
      case 'auth-required':
        return 'Sign in with Renaiss before checking this release.';
      case 'signing-in':
        return 'Opening Renaiss sign in.';
      case 'opening-demo':
        return 'Opening a Demo Member session.';
      case 'authenticated':
        return 'Renaiss connected. Choose a release to verify.';
      case 'checking':
        return 'Verifying this release against your Safe wallet.';
      case 'wallet-pending':
        return 'Your Safe wallet is not ready yet.';
      case 'eligibility-pending':
        return 'The eligibility rule is not configured yet.';
      case 'source-error':
        return 'The access check could not be completed.';
      case 'auth-error':
        return 'Renaiss sign in did not complete. You can retry here.';
      default:
        return 'Explore the releases, then sign in when you are ready.';
    }
  }, [storeState]);

  useEffect(() => {
    if (CATALOG_VIEW_ENABLED) {
      saveMerchStoreView(storeView);
    }
  }, [storeView]);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const nextSession = await readRenaissSession();

        if (cancelled) {
          return;
        }

        if (!nextSession.authenticated) {
          setSession(nextSession);
          setProductAccess({});
          setStoreState(initialAuthFailed ? 'auth-error' : 'idle');
          return;
        }

        if (!revealMediaController.isAdmissionComplete()) {
          await onAuthenticatedSession();
        }

        const nextProductAccess = await readMerchAccessState();

        if (cancelled) {
          return;
        }

        setSession(nextSession);
        setProductAccess(toProductAccessMap(nextProductAccess));
        setStoreState('authenticated');
      } catch {
        if (!cancelled) {
          setStoreState('source-error');
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [
    initialAuthFailed,
    onAuthenticatedSession,
    revealMediaController
  ]);

  useEffect(() => {
    function syncFulfillmentView() {
      setShowFulfillment(window.location.hash === '#fulfillment');
    }

    window.addEventListener('hashchange', syncFulfillmentView);

    return () => {
      window.removeEventListener('hashchange', syncFulfillmentView);
    };
  }, []);

  useEffect(() => {
    if (
      showFulfillment &&
      storeState !== 'loading-session' &&
      (!session.authenticated || !session.user.canManageFulfillment)
    ) {
      closeFulfillment();
    }
  }, [session, showFulfillment, storeState]);

  function handleLogin() {
    setStoreState('signing-in');
    onLogin();
  }

  async function handleLogout() {
    try {
      await signOutRenaiss();
      setSession({
        authenticated: false,
        demoAvailable: session.demoAvailable
      });
      setSelectedProductId(null);
      setAccessResult(null);
      setProductAccess({});
      setShowSettings(false);
      closeFulfillment();
      setStoreState('idle');
    } catch {
      setStoreState('source-error');
    }
  }

  async function handleDemoAccess() {
    if (storeState === 'loading-session' || storeState === 'opening-demo') {
      return;
    }

    setStoreState('opening-demo');

    try {
      const demoSession = await startDemoRenaissSession(readLocalDemoMode());

      if (!demoSession.authenticated) {
        setStoreState('source-error');
        return;
      }

      await onAuthenticatedSession();
      const nextProductAccess = await readMerchAccessState();

      setSession(demoSession);
      setProductAccess(toProductAccessMap(nextProductAccess));
      setStoreState('authenticated');
    } catch {
      setStoreState('source-error');
    }
  }

  async function handleProductCheck(productId: MerchProductId) {
    if (
      storeState === 'loading-session' ||
      storeState === 'signing-in' ||
      storeState === 'opening-demo' ||
      isChecking
    ) {
      return;
    }

    setSelectedProductId(productId);

    if (!session.authenticated) {
      setStoreState('auth-required');
      return;
    }

    setAccessResult(null);
    setStoreState('checking');

    try {
      const result = await checkMerchEligibility(productId);

      setProductAccess((currentProductAccess) => ({
        ...currentProductAccess,
        [productId]: createMerchAccessProductState(
          productId,
          result,
          currentProductAccess[productId]?.claimStatus || null
        )
      }));

      if (result.status === 'eligible') {
        const revealMedia = revealMediaController.read(productId);

        if (!revealMedia) {
          throw new Error(
            `Eligible reveal media was not admitted before check: ${productId}`
          );
        }

        setAccessResult({ productId, result, revealMedia });
        return;
      }

      setAccessResult({ productId, result });
    } catch (error) {
      if (error instanceof StoreRevealMediaCancelledError) {
        return;
      }

      if (error instanceof EligibilityPendingError) {
        setStoreState(
          error.code === 'safe_wallet_not_ready'
            ? 'wallet-pending'
            : 'eligibility-pending'
        );
        return;
      }

      setStoreState('source-error');
    }
  }

  async function resetAccessResult() {
    setAccessResult(null);
    setSelectedProductId(null);
    setStoreState('authenticated');
    window.scrollTo({ top: 0, behavior: 'auto' });

    if (!session.authenticated) {
      return;
    }

    try {
      setProductAccess(toProductAccessMap(await readMerchAccessState()));
    } catch {
      setStoreState('source-error');
    }
  }

  function openFulfillment() {
    window.location.hash = 'fulfillment';
  }

  function closeFulfillment() {
    if (window.location.hash === '#fulfillment') {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}#store`
      );
    }

    setShowFulfillment(false);
  }

  if (accessResult) {
    return (
      <StoreAccessResult
        onBack={resetAccessResult}
        productId={accessResult.productId}
        revealMedia={accessResult.revealMedia}
        result={accessResult.result}
      />
    );
  }

  return (
    <main
      className={`merch-entry merch-store merch-store--${storeView}`}
      aria-labelledby="merch-store-title"
      style={
        {
          '--merch-store-background':
            staticMerchAssetCssUrl('storeBackground')
        } as CSSProperties
      }
    >
      <header
        className={[
          'merch-store__header',
          isCatalogHeaderScrolled ? 'is-scrolled' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden={showFulfillment || showSettings}
      >
        <button
          className="merch-store__brand"
          onClick={onExitStore}
          type="button"
        >
          <img src={renaissLogoMark} alt="" aria-hidden="true" />
          <span>renaiss merch store</span>
        </button>

        <div className="merch-store__account">
          {session.authenticated ? (
            <>
              {session.user.canManageFulfillment ? (
                <button
                  className="merch-store__secondary-action"
                  onClick={openFulfillment}
                  type="button"
                >
                  Fulfilment
                </button>
              ) : null}
              <button
                className="merch-store__secondary-action"
                onClick={() => setShowSettings(true)}
                type="button"
              >
                Address
              </button>
              <div className="merch-store__identity">
                <span>{sessionLabel || 'Renaiss account'}</span>
                <strong>{walletLabel}</strong>
              </div>
              <button
                className="merch-store__secondary-action"
                onClick={() => void handleLogout()}
                type="button"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              {session.demoAvailable ? (
                <button
                  className="merch-store__demo-action"
                  disabled={
                    storeState === 'loading-session' ||
                    storeState === 'signing-in' ||
                    storeState === 'opening-demo'
                  }
                  onClick={() => void handleDemoAccess()}
                  type="button"
                >
                  {storeState === 'opening-demo' ? 'Opening' : 'Demo access'}
                </button>
              ) : null}
              <button
                className="merch-store__login-action"
                disabled={
                  storeState === 'loading-session' ||
                  storeState === 'signing-in' ||
                  storeState === 'opening-demo'
                }
                onClick={handleLogin}
                type="button"
              >
                {storeState === 'signing-in' ? 'Opening' : 'Login'}
              </button>
            </>
          )}
        </div>
      </header>

      <section
        className="merch-store__content"
        aria-hidden={showFulfillment || showSettings}
      >
        <div className="merch-store__intro">
          <h1 className="merch-store__eyebrow" id="merch-store-title">
            Renaiss Protocol / Private editions
          </h1>
          <p className="merch-store__lede">
            Two sealed releases. Each piece is revealed only after your wallet
            access is verified.
          </p>
        </div>

        {CATALOG_VIEW_ENABLED ? (
          <div className="merch-store__view-bar">
            <span>Display</span>
            <div
              className="merch-store__view-switch"
              role="group"
              aria-label="Product display"
            >
              <button
                aria-pressed={storeView === 'cards'}
                onClick={() => setStoreView('cards')}
                type="button"
              >
                Cards
              </button>
              <button
                aria-pressed={storeView === 'catalog'}
                onClick={() => setStoreView('catalog')}
                type="button"
              >
                Catalog
              </button>
            </div>
          </div>
        ) : null}

        <div
          className={`merch-store__products merch-store__products--${storeView}`}
        >
          {merchCatalog.map((product) => {
            const accessState = productAccess[product.id];
            const disabled =
              storeState === 'loading-session' ||
              storeState === 'signing-in' ||
              storeState === 'opening-demo' ||
              (isChecking && selectedProductId !== product.id);
            const helperText = readProductHelperText(
              product.id,
              selectedProductId,
              storeState
            );
            const productProps = {
              accessState,
              disabled,
              helperText,
              isChecking: isChecking && selectedProductId === product.id,
              onCheck: (productId: MerchProductId) =>
                void handleProductCheck(productId),
              product
            };

            return storeView === 'catalog' ? (
              <CatalogProductTile key={product.id} {...productProps} />
            ) : (
              <MerchProductCard key={product.id} {...productProps} />
            );
          })}
        </div>

        <p
          className={`merch-store__status merch-store__status--${storeState}`}
          role="status"
        >
          {statusText}
        </p>
      </section>

      <footer className="merch-store__footer" aria-hidden="true">
        <span>Private release</span>
        <span>Wallet verified</span>
        <span>Worldwide fulfilment</span>
      </footer>

      {showFulfillment &&
      session.authenticated &&
      session.user.canManageFulfillment ? (
        <FulfillmentConsole onClose={closeFulfillment} />
      ) : null}

      {showSettings && session.authenticated ? (
        <ShippingSettings
          accountLabel={sessionLabel || walletLabel}
          onClose={() => setShowSettings(false)}
        />
      ) : null}
    </main>
  );
}

function readProductHelperText(
  productId: MerchProductId,
  selectedProductId: MerchProductId | null,
  storeState: StoreState
) {
  if (selectedProductId === productId) {
    switch (storeState) {
      case 'auth-required':
        return 'Sign in with Renaiss, then check this release.';
      case 'checking':
        return 'Reading verified SBT access.';
      case 'wallet-pending':
        return 'Your Safe wallet is not ready yet.';
      case 'eligibility-pending':
        return 'Access rules are not ready yet.';
      case 'source-error':
        return 'Check unavailable. Please try again.';
      default:
        break;
    }
  }

  return undefined;
}

function readLocalDemoMode(): 'eligible' | 'unqualified' {
  return new URLSearchParams(window.location.search).get('demo') ===
    'unqualified'
    ? 'unqualified'
    : 'eligible';
}

function toProductAccessMap(
  products: readonly MerchAccessProductState[]
): Partial<Record<MerchProductId, MerchAccessProductState>> {
  const productAccess: Partial<
    Record<MerchProductId, MerchAccessProductState>
  > = {};

  for (const product of products) {
    productAccess[product.productId] = product;
  }

  return productAccess;
}

function shortenWallet(walletAddress: string) {
  if (walletAddress.length <= 14) {
    return walletAddress;
  }

  return `${walletAddress.slice(0, 7)}...${walletAddress.slice(-5)}`;
}

function formatTwitterUsername(username: string | null | undefined) {
  if (!username) {
    return null;
  }

  return username.startsWith('@') ? username : `@${username}`;
}
