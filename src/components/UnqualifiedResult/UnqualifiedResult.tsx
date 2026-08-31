import { type CSSProperties } from 'react';
import {
  getVerifiedSbtCount,
  type MerchEligibilityResult
} from '../../lib/merchEligibility';
import { readRenaissLogoutReturnUrl } from '../../lib/renaissAuth';
import { useLocale } from '../../i18n/LocaleContext';
import './UnqualifiedResult.css';

type UnqualifiedResultProps = {
  result: MerchEligibilityResult;
};

export function UnqualifiedResult({
  result
}: UnqualifiedResultProps) {
  const { locale } = useLocale();
  const copy = unqualifiedCopy[locale];
  const minimumSbtBalance = result.minimumSbtBalance;
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
          <h2 id="unqualified-title">{copy.title}</h2>
          <p>{copy.description(minimumSbtBalance)}</p>
        </div>

        <div className="unqualified-result__panel" aria-label={copy.panelLabel}>
          <div className="unqualified-result__panel-header">
            <span>{copy.gate}</span>
            <strong>{copy.closed}</strong>
          </div>

          <div className="unqualified-result__meter">
            <div className="unqualified-result__meter-top">
              <span>{copy.verified}</span>
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
              <dt>{copy.required}</dt>
              <dd>{minimumSbtBalance} SBT</dd>
            </div>
            <div>
              <dt>{copy.current}</dt>
              <dd>{verifiedSbtCount} SBT</dd>
            </div>
            <div>
              <dt>{copy.missing}</dt>
              <dd>{missingSbt} SBT</dd>
            </div>
          </dl>

          <p className="unqualified-result__note">
            {copy.note}
          </p>

          <a
            className="unqualified-result__reset-link"
            href={readRenaissLogoutReturnUrl()}
          >
            {copy.checkAnotherWallet}
          </a>
        </div>
      </div>
    </section>
  );
}

const unqualifiedCopy = {
  en: {
    checkAnotherWallet: 'Check another wallet',
    closed: 'Closed',
    current: 'Current',
    description: (minimum: number) =>
      `This wallet does not meet the ${minimum} SBT merch claim requirement.`,
    gate: 'Merch gate',
    missing: 'Missing',
    note:
      'Claim access opens after the connected wallet reaches the required SBT balance.',
    panelLabel: 'SBT check result',
    required: 'Required',
    title: 'Unqualified',
    verified: 'Verified SBT'
  },
  'zh-TW': {
    checkAnotherWallet: '檢查其他錢包',
    closed: '尚未開放',
    current: '目前持有',
    description: (minimum: number) =>
      `此錢包尚未達到領取商品所需的 ${minimum} SBT。`,
    gate: '商品資格',
    missing: '尚缺',
    note: '連線錢包達到所需 SBT 數量後，即可開啟領取資格。',
    panelLabel: 'SBT 檢查結果',
    required: '需要',
    title: '不符合資格',
    verified: '已驗證 SBT'
  }
} as const;
