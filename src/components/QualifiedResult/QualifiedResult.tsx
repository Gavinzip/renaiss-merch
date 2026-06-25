import {
  MINIMUM_MERCH_SBT_BALANCE,
  type MerchEligibilityResult
} from '../../lib/merchEligibility';
import './QualifiedResult.css';

type QualifiedResultProps = {
  result: MerchEligibilityResult;
  onBack: () => void;
};

export function QualifiedResult({ result, onBack }: QualifiedResultProps) {
  return (
    <section
      className="qualified-result"
      aria-labelledby="qualified-title"
      aria-live="polite"
    >
      <button
        className="qualified-result__close"
        onClick={onBack}
        type="button"
        aria-label="Back to eligibility check"
      >
        <span aria-hidden="true">×</span>
      </button>

      <div className="qualified-result__content">
        <p className="qualified-result__code" id="qualified-title">
          Qualified
        </p>
        <h2>This wallet is eligible for merch.</h2>
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
