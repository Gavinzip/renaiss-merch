import renaissProtocolLogo from '../../assets/renaiss-protocol-logo.png';
import Prism from '../Prism/Prism';
import '../MerchEligibilityEntry/MerchEligibilityEntry.css';
import './MerchLanding.css';

type MerchLandingProps = {
  onEnterStore: () => void;
};

export function MerchLanding({ onEnterStore }: MerchLandingProps) {
  return (
    <main className="merch-entry merch-landing" aria-labelledby="merch-entry-title">
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
        <p className="merch-entry__mark">
          <img src={renaissProtocolLogo} alt="Renaiss Protocol" />
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
      </section>

      <div className="merch-entry__footer" aria-hidden="true">
        <span>Private editions</span>
        <span>Renaiss access</span>
        <span>Merch store</span>
      </div>
    </main>
  );
}
