import { staticMerchAssetUrl } from '../../lib/staticAssets';
import { useLocale } from '../../i18n/LocaleContext';
import Prism from '../Prism/Prism';
import '../MerchEligibilityEntry/MerchEligibilityEntry.css';
import './MerchLanding.css';

type MerchLandingProps = {
  loadProgress: number;
  loadState: 'idle' | 'loading' | 'error';
  onEnterStore: () => void;
  onRetry: () => void;
};

export function MerchLanding({
  loadProgress,
  loadState,
  onEnterStore,
  onRetry
}: MerchLandingProps) {
  const { locale } = useLocale();
  const copy = landingCopy[locale];
  const isLoading = loadState === 'loading';

  return (
    <main
      aria-busy={isLoading}
      aria-labelledby="merch-entry-title"
      className={[
        'merch-entry',
        'merch-landing',
        isLoading ? 'is-loading' : '',
        loadState === 'error' ? 'has-load-error' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="merch-entry__background" aria-hidden="true">
        <Prism
          animationType="3drotate"
          baseWidth={8.4}
          bloom={1.28}
          colorFrequency={1.08}
          glow={1.18}
          height={5.1}
          hueShift={0.06}
          noise={0.08}
          offset={{ x: 0, y: -20 }}
          scale={3.05}
          suspendWhenOffscreen
          timeScale={0.38}
          transparent
        />
      </div>

      <section className="merch-entry__content">
        {loadState === 'idle' ? (
          <>
            <p className="merch-entry__mark">
              <img
                src={staticMerchAssetUrl('renaissProtocolLogo')}
                alt="Renaiss Protocol"
              />
            </p>
            <h1 id="merch-entry-title">RENAISS MERCH</h1>
            <p className="merch-entry__copy">
              {copy.intro}
            </p>

            <div className="merch-entry__form merch-landing__action">
              <button type="button" onClick={onEnterStore}>
                {copy.enterStore}
              </button>
            </div>
          </>
        ) : (
          <div className="merch-landing__loading">
            <p className="merch-landing__loading-kicker">Renaiss merch</p>
            <h1 id="merch-entry-title">
              {isLoading ? copy.loadingTitle : copy.errorTitle}
            </h1>

            {isLoading ? (
              <>
                <div
                  aria-label={copy.progressLabel}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={loadProgress}
                  className="merch-landing__progress"
                  role="progressbar"
                >
                  <span style={{ width: `${loadProgress}%` }} />
                </div>
                <p className="merch-landing__progress-value">
                  {String(loadProgress).padStart(2, '0')}%
                </p>
              </>
            ) : (
              <>
                <p className="merch-entry__copy">
                  {copy.loadError}
                </p>
                <div className="merch-entry__form merch-landing__action">
                  <button type="button" onClick={onRetry}>
                    {copy.tryAgain}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <div className="merch-entry__footer" aria-hidden="true">
        <span>{copy.footerPrivate}</span>
        <span>{copy.footerAccess}</span>
        <span>{copy.footerStore}</span>
      </div>
    </main>
  );
}

const landingCopy = {
  en: {
    enterStore: 'Enter store',
    errorTitle: 'LOAD INTERRUPTED',
    footerAccess: 'Renaiss access',
    footerPrivate: 'Private editions',
    footerStore: 'Merch store',
    intro: 'Enter the private Renaiss merch store.',
    loadError: 'The store assets could not be loaded.',
    loadingTitle: 'LOADING STORE',
    progressLabel: 'Store loading progress',
    tryAgain: 'Try again'
  },
  'zh-TW': {
    enterStore: '進入商店',
    errorTitle: '載入中斷',
    footerAccess: 'Renaiss 資格',
    footerPrivate: '限定系列',
    footerStore: '周邊商店',
    intro: '進入 Renaiss 限定周邊商店。',
    loadError: '商店素材目前無法載入。',
    loadingTitle: '正在載入商店',
    progressLabel: '商店載入進度',
    tryAgain: '再試一次'
  }
} as const;
