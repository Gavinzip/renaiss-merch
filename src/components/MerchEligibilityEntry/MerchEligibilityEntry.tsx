import { useEffect, useMemo, useState } from 'react';
import { QualifiedResult } from '../QualifiedResult/QualifiedResult';
import Prism from '../Prism/Prism';
import { UnqualifiedResult } from '../UnqualifiedResult/UnqualifiedResult';
import {
  EligibilityPendingError,
  checkMerchEligibility,
  type MerchEligibilityResult
} from '../../lib/merchEligibility';
import {
  readRenaissSession,
  signOutRenaiss,
  startRenaissLogin,
  startRenaissLogoutReturn,
  type RenaissSession
} from '../../lib/renaissAuth';
import './MerchEligibilityEntry.css';

type CheckState =
  | 'loading-session'
  | 'idle'
  | 'signing-in'
  | 'checking'
  | 'authenticated'
  | 'wallet-pending'
  | 'eligibility-pending'
  | 'source-error'
  | 'auth-error';
type ResultView = 'qualified' | 'unqualified' | null;

const MINIMUM_CHECK_DURATION_MS = 820;

export function MerchEligibilityEntry() {
  const [session, setSession] = useState<RenaissSession>({
    authenticated: false
  });
  const [checkState, setCheckState] = useState<CheckState>('loading-session');
  const [eligibilityResult, setEligibilityResult] =
    useState<MerchEligibilityResult | null>(null);
  const [pendingWalletAddress, setPendingWalletAddress] = useState<
    string | null
  >(null);
  const [resultView, setResultView] = useState<ResultView>(null);
  const [isReturningHome, setIsReturningHome] = useState(false);

  const user = session.authenticated ? session.user : null;
  const sessionWalletAddress =
    pendingWalletAddress || user?.safeWalletAddress || null;
  const sessionLabel =
    user?.name || user?.email || formatTwitterUsername(user?.twitterUsername);
  const walletLabel = sessionWalletAddress
    ? shortenWallet(sessionWalletAddress)
    : 'Safe wallet pending';
  const isChecking = checkState === 'checking';

  const statusText = useMemo(() => {
    switch (checkState) {
      case 'loading-session':
        return 'Checking Renaiss session.';
      case 'signing-in':
        return 'Opening Renaiss sign in.';
      case 'checking':
        return 'Renaiss connected. Checking merch access.';
      case 'authenticated':
        return 'Renaiss session is connected.';
      case 'wallet-pending':
        return 'Renaiss connected. Safe wallet is not ready yet.';
      case 'eligibility-pending':
        return 'Renaiss connected. Eligibility rule is not configured yet.';
      case 'source-error':
        return 'Could not complete the merch check.';
      case 'auth-error':
        return 'Renaiss sign in could not be completed.';
      default:
        return 'Sign in with Renaiss to check merch access.';
    }
  }, [checkState]);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      const authState = consumeAuthQueryState();

      try {
        const nextSession = await readRenaissSession();

        if (cancelled) {
          return;
        }

        setSession(nextSession);

        if (!nextSession.authenticated) {
          setCheckState(authState === 'error' ? 'auth-error' : 'idle');
          return;
        }

        setPendingWalletAddress(null);
        setEligibilityResult(null);
        setResultView(null);
        setCheckState('authenticated');
      } catch {
        if (!cancelled) {
          setCheckState('source-error');
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogin() {
    setCheckState('signing-in');
    startRenaissLogin();
  }

  async function handleLogout() {
    try {
      await signOutRenaiss();
      setSession({ authenticated: false });
      setPendingWalletAddress(null);
      setEligibilityResult(null);
      setResultView(null);
      setCheckState('idle');
    } catch {
      setCheckState('source-error');
    }
  }

  function resetEligibilityCheck() {
    if (isReturningHome) {
      return;
    }

    setIsReturningHome(true);
    window.scrollTo({ top: 0, behavior: 'auto' });
    setSession({ authenticated: false });
    setPendingWalletAddress(null);
    setEligibilityResult(null);
    setResultView(null);
    setCheckState('idle');
    startRenaissLogoutReturn('/');
  }

  async function runEligibilityCheck(shouldCancel = () => false) {
    if (shouldCancel()) {
      return;
    }

    setPendingWalletAddress(null);
    setEligibilityResult(null);
    setResultView(null);
    setCheckState('checking');

    const startedAt = performance.now();

    try {
      const result = await checkMerchEligibility();
      await waitForCheckTempo(startedAt);

      if (shouldCancel()) {
        return;
      }

      setEligibilityResult(result);
      setResultView(result.status === 'eligible' ? 'qualified' : 'unqualified');
    } catch (error) {
      await waitForCheckTempo(startedAt);

      if (shouldCancel()) {
        return;
      }

      if (error instanceof EligibilityPendingError) {
        setPendingWalletAddress(error.walletAddress);
        setCheckState(
          error.code === 'safe_wallet_not_ready'
            ? 'wallet-pending'
            : 'eligibility-pending'
        );
        return;
      }

      setCheckState('source-error');
    }
  }

  return (
    <main
      className={[
        'merch-entry',
        resultView ? 'merch-entry--result' : '',
        resultView === 'qualified' ? 'merch-entry--qualified' : '',
        resultView === 'unqualified' ? 'merch-entry--unqualified' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby="merch-entry-title"
    >
      {!resultView ? (
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
      ) : null}

      <section className="merch-entry__content" aria-hidden={!!resultView}>
        <p className="merch-entry__mark">RENAISS</p>
        <h1 id="merch-entry-title">RENAISS MERCH</h1>
        <p className="merch-entry__copy">
          Check whether your wallet is eligible to claim merch.
        </p>

        <div
          className="merch-entry__form merch-entry__form--auth"
          aria-busy={isChecking}
        >
          <div className="merch-entry__login-panel">
            {session.authenticated ? (
              <>
                <div className="merch-entry__identity">
                  <span className="merch-entry__identity-label">
                    {sessionLabel || 'Renaiss account'}
                  </span>
                  <span className="merch-entry__identity-value">
                    {walletLabel}
                  </span>
                </div>
                <button
                  className="merch-entry__login-action"
                  type="button"
                  onClick={() => void handleLogout()}
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleLogin}
                disabled={
                  checkState === 'loading-session' || checkState === 'signing-in'
                }
              >
                Login
              </button>
            )}
          </div>
          <div className="merch-entry__choices" aria-label="Merch check">
            <button
              type="button"
              onClick={() => void runEligibilityCheck()}
              disabled={!session.authenticated || isChecking}
            >
              {isChecking ? 'Checking' : 'Check'}
            </button>
          </div>
        </div>

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
            isExiting={isReturningHome}
            onBack={resetEligibilityCheck}
          />
        ) : null}

      {resultView === 'unqualified' && eligibilityResult ? (
          <UnqualifiedResult
            result={eligibilityResult}
            isExiting={isReturningHome}
            onBack={resetEligibilityCheck}
          />
        ) : null}
    </main>
  );
}

function consumeAuthQueryState() {
  const url = new URL(window.location.href);
  const authState = url.searchParams.get('auth');

  if (authState) {
    url.searchParams.delete('auth');
    url.searchParams.delete('reason');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  return authState;
}

async function waitForCheckTempo(startedAt: number) {
  const remaining = MINIMUM_CHECK_DURATION_MS - (performance.now() - startedAt);

  if (remaining > 0) {
    await delay(remaining);
  }
}

function delay(duration: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function shortenWallet(walletAddress: string) {
  return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
}

function formatTwitterUsername(username: string | null | undefined) {
  return username ? `@${username}` : null;
}
