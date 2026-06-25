import { FormEvent, useMemo, useState } from 'react';
import { QualifiedResult } from '../QualifiedResult/QualifiedResult';
import Prism from '../Prism/Prism';
import { UnqualifiedResult } from '../UnqualifiedResult/UnqualifiedResult';
import {
  MINIMUM_MERCH_SBT_BALANCE,
  type MerchEligibilityResult
} from '../../lib/merchEligibility';
import './MerchEligibilityEntry.css';

const walletPattern = /^0x[a-fA-F0-9]{40}$/;
const previewWalletAddress = '0x000000000000000000000000000000000000dEaD';

type CheckState = 'idle' | 'invalid';
type ResultView = 'qualified' | 'unqualified' | null;

export function MerchEligibilityEntry() {
  const [walletAddress, setWalletAddress] = useState('');
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [eligibilityResult, setEligibilityResult] =
    useState<MerchEligibilityResult | null>(null);
  const [resultView, setResultView] = useState<ResultView>(null);

  const normalizedWallet = useMemo(() => walletAddress.trim(), [walletAddress]);

  const statusText = useMemo(() => {
    if (checkState === 'invalid') {
      return 'Enter a valid 0x wallet address to start the merch check.';
    }

    return 'Preview mode for the merch gate result.';
  }, [checkState]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function previewEligibility(status: MerchEligibilityResult['status']) {
    const walletForPreview = normalizedWallet || previewWalletAddress;

    if (!walletPattern.test(walletForPreview)) {
      setEligibilityResult(null);
      setCheckState('invalid');
      return;
    }

    setCheckState('idle');
    setEligibilityResult({
      walletAddress: walletForPreview,
      sbtBalance:
        status === 'eligible' ? MINIMUM_MERCH_SBT_BALANCE : 0,
      status
    });
    setResultView(status === 'eligible' ? 'qualified' : 'unqualified');
  }

  function resetEligibilityCheck() {
    setResultView(null);
    setEligibilityResult(null);
    setCheckState('idle');
  }

  return (
    <main
      className={`merch-entry ${resultView ? 'merch-entry--result' : ''}`}
      aria-labelledby="merch-entry-title"
    >
      <div className="merch-entry__background" aria-hidden="true">
        <Prism
          animationType="3drotate"
          baseWidth={6.8}
          bloom={1.45}
          colorFrequency={1.25}
          glow={1.35}
          height={4.1}
          hueShift={0.08}
          noise={0.1}
          offset={{ x: 0, y: -34 }}
          scale={2.45}
          suspendWhenOffscreen
          timeScale={0.42}
          transparent
        />
      </div>

      <section className="merch-entry__content" aria-hidden={!!resultView}>
        <p className="merch-entry__mark">RENAISS</p>
        <h1 id="merch-entry-title">RENAISS MERCH</h1>
        <p className="merch-entry__copy">
          Check whether your wallet is eligible to claim merch.
        </p>

        <form className="merch-entry__form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="wallet-address">
            Wallet address
          </label>
          <input
            id="wallet-address"
            autoComplete="off"
            inputMode="text"
            onChange={(event) => {
              setWalletAddress(event.target.value);
              if (checkState !== 'idle') {
                setCheckState('idle');
              }
            }}
            placeholder="0x wallet address"
            spellCheck={false}
            type="text"
            value={walletAddress}
          />
          <div className="merch-entry__choices">
            <button type="button" onClick={() => previewEligibility('eligible')}>
              Yes
            </button>
            <button
              className="merch-entry__choice--no"
              type="button"
              onClick={() => previewEligibility('unqualified')}
            >
              No
            </button>
          </div>
        </form>

        <p
          className={`merch-entry__status merch-entry__status--${checkState}`}
          role="status"
        >
          {statusText}
        </p>
      </section>

      <div className="merch-entry__footer" aria-hidden="true">
        <span>Claim access</span>
        <span>Wallet check</span>
        <span>Merch gate</span>
      </div>

      {resultView === 'qualified' && eligibilityResult ? (
        <QualifiedResult
          result={eligibilityResult}
          onBack={resetEligibilityCheck}
        />
      ) : null}

      {resultView === 'unqualified' && eligibilityResult ? (
        <UnqualifiedResult
          result={eligibilityResult}
          onBack={resetEligibilityCheck}
        />
      ) : null}
    </main>
  );
}
