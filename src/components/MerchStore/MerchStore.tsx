import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction
} from 'react';
import {
  staticMerchAssetCssUrl,
  staticMerchAssetUrl
} from '../../lib/staticAssets';
import {
  createMerchAccessProductState,
  readMerchAccessState,
  type MerchAccessState,
  type MerchAccessProductState
} from '../../lib/merchAccessState';
import {
  EligibilityPendingError,
  checkMerchEligibility,
  type MerchEligibilityResult
} from '../../lib/merchEligibility';
import {
  prepareEligiblePrivateProductImages,
  preparePrivateProductImage,
  type PreparedPrivateProductImageUrls
} from '../../lib/privateProductImages';
import {
  readRenaissSession,
  signOutRenaiss,
  startDemoRenaissSession,
  type RenaissSession
} from '../../lib/renaissAuth';
import { reviewChineseShippingDetails } from '../../lib/chineseShippingValidation';
import {
  needsTaiwanSevenElevenUpdate,
  readReturnedSevenElevenContext
} from '../../lib/sevenElevenStore';
import type { PreparedRevealMedia } from '../../lib/revealMediaPreload';
import { readStoredShippingProfile } from '../../lib/shippingProfile';
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
import { useMerchInventory } from './useMerchInventory';
import { useScrolledHeader } from './useScrolledHeader';
import {
  useLocale,
  type AppLocale
} from '../../i18n/LocaleContext';
import { merchStoreCopy } from '../../i18n/merchStoreCopy';
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
  | 'making'
  | 'wallet-pending'
  | 'eligibility-pending'
  | 'source-error'
  | 'auth-error';

type AccessResult = {
  productId: MerchProductId;
  revealMedia?: PreparedRevealMedia;
  result: MerchEligibilityResult;
};

type ProductPreparationProgress = {
  percent: number;
  productId: MerchProductId;
};

type MerchStoreProps = {
  initialAuthFailed: boolean;
  onExitStore?: () => void;
  onLogin: () => void;
  revealMediaController: StoreRevealMediaController;
};

export function MerchStore({
  initialAuthFailed,
  onExitStore,
  onLogin,
  revealMediaController
}: MerchStoreProps) {
  const { locale, setLocale } = useLocale();
  const copy = merchStoreCopy[locale];
  const [session, setSession] = useState<RenaissSession>({
    authenticated: false
  });
  const [storeState, setStoreState] =
    useState<StoreState>('loading-session');
  const [selectedProductId, setSelectedProductId] =
    useState<MerchProductId | null>(null);
  const [accessResult, setAccessResult] = useState<AccessResult | null>(null);
  const [accessResultReady, setAccessResultReady] = useState(false);
  const [productAccess, setProductAccess] = useState<
    Partial<Record<MerchProductId, MerchAccessProductState>>
  >({});
  const [privateMediaRelease, setPrivateMediaRelease] = useState('');
  const [productImageUrls, setProductImageUrls] =
    useState<PreparedPrivateProductImageUrls>({});
  const [productPreparationProgress, setProductPreparationProgress] =
    useState<ProductPreparationProgress | null>(null);
  const [backgroundMediaError, setBackgroundMediaError] =
    useState(false);
  const [showFulfillment, setShowFulfillment] = useState(
    () => window.location.hash === '#fulfillment'
  );
  const [showSettings, setShowSettings] = useState(
    () => readReturnedSevenElevenContext()?.context === 'profile'
  );
  const [addressNeedsUpdate, setAddressNeedsUpdate] = useState(false);
  const [addressReviewUnavailable, setAddressReviewUnavailable] =
    useState(false);
  const [storeView, setStoreView] = useState<MerchStoreView>(
    () =>
      CATALOG_VIEW_ENABLED ? readStoredMerchStoreView() : 'cards'
  );
  const accessResultGenerationRef = useRef(0);
  const productCheckGenerationRef = useRef(0);
  const isCatalogHeaderScrolled = useScrolledHeader(storeView === 'catalog');
  const inventoryScope =
    session.authenticated && session.user.isDemo
      ? 'demo'
      : 'production';
  const {
    inventoryByProduct,
    inventoryLoadState,
    refreshInventory
  } = useMerchInventory(inventoryScope);
  const prepareStoredProductImages = useCallback(
    async (
      accessState: MerchAccessState,
      isCurrent: () => boolean = () => true
    ) => {
      try {
        const imageUrls = await prepareEligiblePrivateProductImages(
          accessState.products,
          accessState.privateMediaRelease
        );

        if (!isCurrent()) {
          return;
        }

        setProductImageUrls((currentImageUrls) => ({
          ...currentImageUrls,
          ...imageUrls
        }));
        setBackgroundMediaError(false);
      } catch {
        if (isCurrent()) {
          setBackgroundMediaError(true);
        }
      }
    },
    []
  );

  const user = session.authenticated ? session.user : null;
  const authenticatedUserSub = user?.sub || null;
  const sessionLabel = user?.isDemo
    ? copy.demoMember
    : user?.name ||
      user?.email ||
      formatTwitterUsername(user?.twitterUsername);
  const walletLabel = user?.safeWalletAddress
    ? shortenWallet(user.safeWalletAddress)
    : copy.safeWalletPending;
  const isPreparing =
    storeState === 'checking' || storeState === 'making';
  const showAddressWarning =
    addressNeedsUpdate || addressReviewUnavailable;
  const handleProfileReviewChange = useCallback((needsUpdate: boolean) => {
    setAddressNeedsUpdate(needsUpdate);
    setAddressReviewUnavailable(false);
  }, []);
  const handleAccessResultMediaReady = useCallback(() => {
    if (
      accessResultGenerationRef.current !==
      productCheckGenerationRef.current
    ) {
      return;
    }

    setProductPreparationProgress(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
    setAccessResultReady(true);
  }, []);
  const statusText = useMemo(() => {
    if (
      backgroundMediaError &&
      (storeState === 'idle' || storeState === 'authenticated')
    ) {
      return copy.backgroundMediaError;
    }

    return copy.status[storeState];
  }, [backgroundMediaError, copy, storeState]);

  useEffect(() => {
    if (CATALOG_VIEW_ENABLED) {
      saveMerchStoreView(storeView);
    }
  }, [storeView]);

  useEffect(() => {
    let cancelled = false;
    const animationFrameId = window.requestAnimationFrame(() => {
      void revealMediaController.prepareAll(() => undefined).catch((error) => {
        if (
          !cancelled &&
          !(error instanceof StoreRevealMediaCancelledError)
        ) {
          setBackgroundMediaError(true);
        }
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [revealMediaController]);

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

        const nextProductAccess = await readMerchAccessState();

        if (cancelled) {
          return;
        }

        setSession(nextSession);
        applyProductAccess(
          nextProductAccess,
          setPrivateMediaRelease,
          setProductAccess
        );
        setStoreState('authenticated');
        void prepareStoredProductImages(
          nextProductAccess,
          () => !cancelled
        );

        const returnedSelection = readReturnedSevenElevenContext();

        if (
          returnedSelection?.context === 'claim' &&
          returnedSelection.productId
        ) {
          const storedAccess = nextProductAccess.products.find(
            (product) => product.productId === returnedSelection.productId
          );
          const revealMedia = revealMediaController.read(
            returnedSelection.productId
          );

          if (storedAccess?.status === 'eligible' && revealMedia) {
            setSelectedProductId(returnedSelection.productId);
            setAccessResult({
              productId: returnedSelection.productId,
              result: storedAccess,
              revealMedia
            });
          }
        }
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
    prepareStoredProductImages,
    revealMediaController
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!authenticatedUserSub) {
      setAddressNeedsUpdate(false);
      setAddressReviewUnavailable(false);
      return undefined;
    }

    setAddressNeedsUpdate(false);
    setAddressReviewUnavailable(false);

    async function loadAddressReviewStatus() {
      try {
        const storedProfile = await readStoredShippingProfile();

        if (!cancelled) {
          setAddressNeedsUpdate(
            reviewChineseShippingDetails(storedProfile.profile).needsUpdate ||
              needsTaiwanSevenElevenUpdate(storedProfile.profile)
          );
          setAddressReviewUnavailable(false);
        }
      } catch {
        if (!cancelled) {
          setAddressReviewUnavailable(true);
        }
      }
    }

    void loadAddressReviewStatus();

    return () => {
      cancelled = true;
    };
  }, [authenticatedUserSub]);

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
    productCheckGenerationRef.current += 1;
    setProductPreparationProgress(null);

    try {
      await signOutRenaiss();
      setSession({
        authenticated: false,
        demoAvailable: session.demoAvailable
      });
      setSelectedProductId(null);
      setAccessResult(null);
      setAccessResultReady(false);
      setProductPreparationProgress(null);
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

      const nextProductAccess = await readMerchAccessState();

      setSession(demoSession);
      applyProductAccess(
        nextProductAccess,
        setPrivateMediaRelease,
        setProductAccess
      );
      setStoreState('authenticated');
      void prepareStoredProductImages(nextProductAccess);
    } catch {
      setStoreState('source-error');
    }
  }

  async function handleProductCheck(productId: MerchProductId) {
    if (
      storeState === 'loading-session' ||
      storeState === 'signing-in' ||
      storeState === 'opening-demo' ||
      isPreparing
    ) {
      return;
    }

    const checkGeneration = ++productCheckGenerationRef.current;
    setSelectedProductId(productId);

    if (!session.authenticated) {
      setStoreState('auth-required');
      return;
    }

    setAccessResult(null);
    setAccessResultReady(false);
    setProductPreparationProgress(null);
    setStoreState('checking');

    try {
      let mediaPercent = revealMediaController.read(productId) ? 100 : 0;
      let imageReady = !!productImageUrls[productId];

      function syncMakingProgress() {
        if (productCheckGenerationRef.current !== checkGeneration) {
          return;
        }

        setProductPreparationProgress((currentProgress) =>
          currentProgress?.productId === productId
            ? {
                percent: readMakingProgress(mediaPercent, imageReady),
                productId
              }
            : currentProgress
        );
      }

      const revealMediaPromise = revealMediaController.prepareProduct(
        productId,
        (progress) => {
          mediaPercent = progress.percent;
          syncMakingProgress();
        }
      );
      void revealMediaPromise.then(
        () => {
          if (productCheckGenerationRef.current === checkGeneration) {
            setBackgroundMediaError(false);
          }
        },
        (error) => {
          if (
            productCheckGenerationRef.current === checkGeneration &&
            !(error instanceof StoreRevealMediaCancelledError)
          ) {
            setBackgroundMediaError(true);
          }
        }
      );

      const result = await checkMerchEligibility(productId);

      if (productCheckGenerationRef.current !== checkGeneration) {
        return;
      }

      setProductAccess((currentProductAccess) => ({
        ...currentProductAccess,
        [productId]: createMerchAccessProductState(
          productId,
          result,
          currentProductAccess[productId]?.claimStatus || null
        )
      }));

      if (result.status === 'unqualified') {
        setProductPreparationProgress(null);
        setAccessResultReady(true);
        setAccessResult({ productId, result });
        return;
      }

      const admittedRevealMedia = revealMediaController.read(productId);
      const admittedProductImage = productImageUrls[productId];

      if (admittedRevealMedia && admittedProductImage) {
        setBackgroundMediaError(false);
        accessResultGenerationRef.current = checkGeneration;
        setProductPreparationProgress(null);
        setStoreState('authenticated');
        window.scrollTo({ top: 0, behavior: 'auto' });
        setAccessResultReady(false);
        setAccessResult({
          productId,
          result,
          revealMedia: admittedRevealMedia
        });
        return;
      }

      setStoreState('making');
      setProductPreparationProgress({
        percent: readMakingProgress(mediaPercent, imageReady),
        productId
      });

      const [revealMedia, productImageUrl] = await Promise.all([
        revealMediaPromise,
        admittedProductImage
          ? Promise.resolve(admittedProductImage)
          : preparePrivateProductImage(
              productId,
              privateMediaRelease
            ).then((preparedImageUrl) => {
              imageReady = true;
              syncMakingProgress();
              return preparedImageUrl;
            })
      ]);

      if (productCheckGenerationRef.current !== checkGeneration) {
        return;
      }

      if (!productImageUrl) {
        throw new Error(
          `Eligible product image was not admitted before check: ${productId}`
        );
      }

      setBackgroundMediaError(false);
      setProductImageUrls((currentImageUrls) => ({
        ...currentImageUrls,
        [productId]: productImageUrl
      }));
      setProductPreparationProgress({ percent: 99, productId });
      accessResultGenerationRef.current = checkGeneration;
      setAccessResultReady(false);
      setAccessResult({ productId, result, revealMedia });
    } catch (error) {
      if (productCheckGenerationRef.current !== checkGeneration) {
        return;
      }

      setProductPreparationProgress(null);

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
    const resetGeneration = ++productCheckGenerationRef.current;
    setAccessResult(null);
    setAccessResultReady(false);
    setProductPreparationProgress(null);
    setSelectedProductId(null);
    setStoreState('authenticated');
    window.scrollTo({ top: 0, behavior: 'auto' });

    if (!session.authenticated) {
      return;
    }

    try {
      const [nextProductAccess] = await Promise.all([
        readMerchAccessState(),
        refreshInventory()
      ]);

      if (productCheckGenerationRef.current !== resetGeneration) {
        return;
      }

      applyProductAccess(
        nextProductAccess,
        setPrivateMediaRelease,
        setProductAccess
      );
      void prepareStoredProductImages(nextProductAccess);
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

  function handleExitStore() {
    productCheckGenerationRef.current += 1;
    onExitStore?.();
  }

  const showStore = !accessResult || !accessResultReady;

  return (
    <>
      {showStore ? (
        <main
          key="store"
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
          onClick={handleExitStore}
          type="button"
        >
          <img
            src={staticMerchAssetUrl('renaissLogoMark')}
            alt=""
            aria-hidden="true"
          />
          <span>{copy.brand}</span>
        </button>

        <div className="merch-store__account">
          <div
            aria-label={copy.languageLabel}
            className="merch-store__language-switch"
            role="group"
          >
            <button
              aria-pressed={locale === 'en'}
              className={locale === 'en' ? 'is-active' : ''}
              onClick={() => setLocale('en')}
              type="button"
            >
              EN
            </button>
            <button
              aria-pressed={locale === 'zh-TW'}
              className={locale === 'zh-TW' ? 'is-active' : ''}
              onClick={() => setLocale('zh-TW')}
              type="button"
            >
              中文
            </button>
          </div>
          {session.authenticated ? (
            <>
              {session.user.canManageFulfillment ? (
                <button
                  className="merch-store__secondary-action"
                  onClick={openFulfillment}
                  type="button"
                >
                  {copy.fulfillment}
                </button>
              ) : null}
              <button
                aria-label={
                  addressNeedsUpdate
                    ? copy.addressUpdateRequired
                    : addressReviewUnavailable
                      ? copy.addressStatusUnavailable
                      : copy.address
                }
                className={`merch-store__secondary-action merch-store__address-action ${
                  showAddressWarning ? 'is-warning' : ''
                }`}
                onClick={() => setShowSettings(true)}
                type="button"
              >
                <span>{copy.address}</span>
                {showAddressWarning ? (
                  <span
                    aria-hidden="true"
                    className="merch-store__address-warning"
                  >
                    !
                  </span>
                ) : null}
              </button>
              <div className="merch-store__identity">
                <span>{sessionLabel || copy.renaissAccount}</span>
                <strong>{walletLabel}</strong>
              </div>
              <button
                className="merch-store__secondary-action"
                onClick={() => void handleLogout()}
                type="button"
              >
                {copy.signOut}
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
                  {storeState === 'opening-demo'
                    ? copy.opening
                    : copy.demoAccess}
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
                {storeState === 'signing-in' ? copy.opening : copy.login}
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
            {copy.title}
          </h1>
          <p className="merch-store__lede">
            {copy.lede}
          </p>
        </div>

        {CATALOG_VIEW_ENABLED ? (
          <div className="merch-store__view-bar">
            <span>{copy.display}</span>
            <div
              className="merch-store__view-switch"
              role="group"
              aria-label={copy.productDisplay}
            >
              <button
                aria-pressed={storeView === 'cards'}
                onClick={() => setStoreView('cards')}
                type="button"
              >
                {copy.cards}
              </button>
              <button
                aria-pressed={storeView === 'catalog'}
                onClick={() => setStoreView('catalog')}
                type="button"
              >
                {copy.catalog}
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
              (isPreparing && selectedProductId !== product.id);
            const helperText = readProductHelperText(
              product.id,
              accessState,
              selectedProductId,
              storeState,
              locale
            );
            const productProps = {
              accessState,
              disabled,
              helperText,
              inventory: inventoryByProduct[product.id],
              inventoryLoadState,
              preparationPhase:
                selectedProductId === product.id &&
                (storeState === 'checking' || storeState === 'making')
                  ? storeState
                  : undefined,
              preparationPercent:
                productPreparationProgress?.productId === product.id
                  ? productPreparationProgress.percent
                  : undefined,
              onCheck: (productId: MerchProductId) =>
                void handleProductCheck(productId),
              product,
              revealedImageUrl: productImageUrls[product.id]
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
        <span>{copy.footerPrivate}</span>
        <span>{copy.footerWallet}</span>
        <span>{copy.footerWorldwide}</span>
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
          onProfileReviewChange={handleProfileReviewChange}
        />
      ) : null}

        </main>
      ) : null}

      {accessResult ? (
        <div
          aria-hidden={!accessResultReady}
          className={`merch-store__result-shell ${
            accessResultReady ? 'is-ready' : 'is-admitting'
          }`}
          inert={accessResultReady ? undefined : true}
          key="access-result"
        >
          <StoreAccessResult
            onBack={resetAccessResult}
            onMediaReady={
              accessResult.result.status === 'eligible'
                ? handleAccessResultMediaReady
                : undefined
            }
            productId={accessResult.productId}
            revealMedia={accessResult.revealMedia}
            result={accessResult.result}
          />
        </div>
      ) : null}
    </>
  );
}

function applyProductAccess(
  access: MerchAccessState,
  setPrivateMediaRelease: Dispatch<SetStateAction<string>>,
  setProductAccess: Dispatch<
    SetStateAction<
      Partial<Record<MerchProductId, MerchAccessProductState>>
    >
  >
) {
  setPrivateMediaRelease(access.privateMediaRelease);
  setProductAccess(toProductAccessMap(access.products));
}

function readMakingProgress(mediaPercent: number, imageReady: boolean) {
  return Math.min(
    99,
    Math.max(0, Math.round(mediaPercent * 0.9 + (imageReady ? 9 : 0)))
  );
}

function readProductHelperText(
  productId: MerchProductId,
  accessState: MerchAccessProductState | undefined,
  selectedProductId: MerchProductId | null,
  storeState: StoreState,
  locale: AppLocale
) {
  const copy = merchStoreCopy[locale];

  if (selectedProductId === productId) {
    switch (storeState) {
      case 'auth-required':
        return copy.helper.authRequired;
      case 'checking':
        return copy.helper.checking;
      case 'making':
        return copy.helper.making;
      case 'wallet-pending':
        return copy.helper.walletPending;
      case 'eligibility-pending':
        return copy.helper.eligibilityPending;
      case 'source-error':
        return accessState?.status === 'eligible'
          ? copy.helper.itemUnavailable
          : copy.helper.checkUnavailable;
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
