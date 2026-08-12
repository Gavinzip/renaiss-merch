import { staticMerchAssetUrl } from '../../lib/staticAssets';
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
              Enter the private Renaiss merch store.
            </p>

            <div className="merch-entry__form merch-landing__action">
              <button type="button" onClick={onEnterStore}>
                Enter store
              </button>
            </div>
          </>
        ) : (
          <div className="merch-landing__loading">
            <p className="merch-landing__loading-kicker">Renaiss merch</p>
            <h1 id="merch-entry-title">
              {isLoading ? 'LOADING STORE' : 'LOAD INTERRUPTED'}
            </h1>

            {isLoading ? (
              <>
                <div
                  aria-label="Store loading progress"
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
                  The store assets could not be loaded.
                </p>
                <div className="merch-entry__form merch-landing__action">
                  <button type="button" onClick={onRetry}>
                    Try again
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <div className="merch-entry__footer" aria-hidden="true">
        <span>Private editions</span>
        <span>Renaiss access</span>
        <span>Merch store</span>
      </div>
    </main>
  );
}
