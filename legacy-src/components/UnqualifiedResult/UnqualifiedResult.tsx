import { type CSSProperties } from 'react';
import {
  getVerifiedSbtCount,
  MINIMUM_MERCH_SBT_BALANCE,
  type MerchEligibilityResult
} from '../../lib/merchEligibility';
import './UnqualifiedResult.css';

type UnqualifiedResultProps = {
  result: MerchEligibilityResult;
};

export function UnqualifiedResult({
  result
}: UnqualifiedResultProps) {
  const minimumSbtBalance =
    result.minimumSbtBalance ?? MINIMUM_MERCH_SBT_BALANCE;
  const verifiedSbtCount = getVerifiedSbtCount(result);
  const missingSbt = Math.max(
    0,
    minimumSbtBalance - verifiedSbtCount
  );
  const progress = Math.min(
    100,
    Math.max(0, (verifiedSbtCount / minimumSbtBalance) * 100)
  );

  return (
    <section
      className="unqualified-result"
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
                {verifiedSbtCount} / {minimumSbtBalance}
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
              <dd>{verifiedSbtCount} SBT</dd>
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

          <a
            className="unqualified-result__reset-link"
            href="/api/auth/logout-return?returnTo=/"
          >
            Check another wallet
          </a>
        </div>
      </div>
    </section>
  );
}
