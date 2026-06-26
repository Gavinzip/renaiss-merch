import { type CSSProperties } from 'react';
import {
  MINIMUM_MERCH_SBT_BALANCE,
  type MerchEligibilityResult
} from '../../lib/merchEligibility';
import './UnqualifiedResult.css';

type UnqualifiedResultProps = {
  isExiting?: boolean;
  result: MerchEligibilityResult;
  onBack: () => void | Promise<void>;
};

export function UnqualifiedResult({
  isExiting = false,
  result,
  onBack
}: UnqualifiedResultProps) {
  const minimumSbtBalance =
    result.minimumSbtBalance ?? MINIMUM_MERCH_SBT_BALANCE;
  const missingSbt = Math.max(
    0,
    minimumSbtBalance - result.sbtBalance
  );
  const progress = Math.min(
    100,
    Math.max(0, (result.sbtBalance / minimumSbtBalance) * 100)
  );

  return (
    <section
      className={`unqualified-result ${
        isExiting ? 'unqualified-result--exiting' : ''
      }`}
      aria-labelledby="unqualified-title"
      aria-live="polite"
      style={{ '--sbt-progress': `${progress}%` } as CSSProperties}
    >
      <div className="unqualified-result__background" aria-hidden="true" />

      <div className="unqualified-result__content">
        <div className="unqualified-result__copy">
          <p className="unqualified-result__eyebrow">RENAISS MERCH</p>
          <h2 id="unqualified-title">Unqualified</h2>
          <p>
            This wallet does not meet the {minimumSbtBalance} SBT merch claim
            requirement.
          </p>
        </div>

        <div className="unqualified-result__panel" aria-label="SBT check result">
          <div className="unqualified-result__panel-header">
            <span>Merch gate</span>
            <strong>Closed</strong>
          </div>

          <div className="unqualified-result__meter">
            <div className="unqualified-result__meter-top">
              <span>Verified SBT</span>
              <strong>
                {result.sbtBalance} / {minimumSbtBalance}
              </strong>
            </div>
            <div className="unqualified-result__meter-track" aria-hidden="true">
              <span />
            </div>
          </div>

          <dl className="unqualified-result__stats">
            <div>
              <dt>Required</dt>
              <dd>{minimumSbtBalance} SBT</dd>
            </div>
            <div>
              <dt>Current</dt>
              <dd>{result.sbtBalance} SBT</dd>
            </div>
            <div>
              <dt>Missing</dt>
              <dd>{missingSbt} SBT</dd>
            </div>
          </dl>

          <p className="unqualified-result__note">
            Claim access opens after the connected wallet reaches the required
            SBT balance.
          </p>

          <button
            type="button"
            onClick={() => void onBack()}
            disabled={isExiting}
          >
            Check another wallet
          </button>
        </div>
      </div>
    </section>
  );
}
