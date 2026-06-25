import {
  MINIMUM_MERCH_SBT_BALANCE,
  type MerchEligibilityResult
} from '../../lib/merchEligibility';
import './UnqualifiedResult.css';

type UnqualifiedResultProps = {
  result: MerchEligibilityResult;
  onBack: () => void;
};

export function UnqualifiedResult({ result, onBack }: UnqualifiedResultProps) {
  return (
    <section
      className="unqualified-result"
      aria-labelledby="unqualified-title"
      aria-live="polite"
    >
      <button
        className="unqualified-result__close"
        onClick={onBack}
        type="button"
        aria-label="Back to eligibility check"
      >
        <span aria-hidden="true">×</span>
      </button>

      <div className="unqualified-result__content">
        <p className="unqualified-result__code" id="unqualified-title">
          Unqualified
        </p>
        <h2>This wallet is not eligible for merch.</h2>
        <p>
          RENAISS MERCH requires at least {MINIMUM_MERCH_SBT_BALANCE} SBT.
          This wallet currently has {result.sbtBalance} SBT.
        </p>
        <button type="button" onClick={onBack}>
          Check another wallet
        </button>
      </div>
    </section>
  );
}
