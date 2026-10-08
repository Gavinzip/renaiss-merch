import type { AppLocale } from '../../i18n/LocaleContext';
import type { useSurfMissions } from './useSurfMissions';
import { missionErrorCopy } from './missionErrorCopy';
import { SurfEmailWarning } from './SurfEmailWarning';

export function SurfAccountTask({ locale, missions, loading, onLogin }: {
  locale: AppLocale; missions: ReturnType<typeof useSurfMissions>; loading: boolean; onLogin: () => void;
}) {
  const account = missions.state?.accounts;
  const stale = account?.stale === true;
  const verified = missions.state?.participation?.tasks.accounts.verified === true;
  const emailWarning = ['renaiss_email_missing', 'renaiss_email_invalid'].includes(account?.reason || '');
  const label = loading ? (inlineCopy[locale].checking) : !missions.state?.authenticated ? (inlineCopy[locale].signInToRenaissFirst) :
    emailWarning ? (inlineCopy[locale].checkYourLinkedRenaissEmail) :
    verified ? (inlineCopy[locale].verificationPassed) : !account?.configured ? (inlineCopy[locale].checkUnavailable) : stale ? (inlineCopy[locale].recheckNeeded) :
    account.outcome === 'incomplete' ? (inlineCopy[locale].notCompleted) :
    account.outcome === 'unavailable' ? (inlineCopy[locale].checkUnavailable) : (inlineCopy[locale].verifyYourSurfAccount);
  const disabled = loading || missions.busy !== null;
  return <div className="surf-social-task surf-account-task" data-verified={verified}>
    <div className="surf-social-task__identity" data-surf-reveal="3" aria-live="polite">
      <span className={`surf-social-task__status ${verified ? 'is-verified' : ''}`}>
        {verified ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg> : <i />}{label}
      </span>
      {account?.email ? <span className="surf-social-task__username">{account.email}</span> : null}
    </div>
    {!missions.state?.authenticated || verified ? null : emailWarning ?
      <SurfEmailWarning locale={locale} reason={account?.reason || ''} onLogin={onLogin} disabled={disabled} /> :
      account?.configured && account.emailLinked ? <div className="surf-social-task__controls"><button type="button" disabled={disabled} onClick={missions.verifyAccounts}>
        {missions.busy === 'accounts' ? (inlineCopy[locale].checking2) : stale ? (inlineCopy[locale].recheck) : (inlineCopy[locale].verifySurfAccount)}
      </button></div> : null}
    {missions.state?.authenticated && account?.reason && !emailWarning ? <p className="surf-social-task__detail">{missionErrorCopy(account.reason, locale)}</p> : null}
    {account?.retryAfterSeconds ? <p className="surf-social-task__detail">{inlineCopy[locale].retryAfter(account.retryAfterSeconds)}</p> : null}
    {account?.checkedAt ? <time className="surf-social-task__time" dateTime={account.checkedAt}>{inlineCopy[locale].lastChecked}{new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(account.checkedAt))}</time> : null}
  </div>;
}

const inlineCopy = {
  "en": {
    retryAfter: (seconds: number) => `Retry after ${seconds} seconds.`,
    checking: "Checking",
    signInToRenaissFirst: "Sign in to Renaiss first",
    checkYourLinkedRenaissEmail: "Check your linked Renaiss email",
    verificationPassed: "Verification passed",
    checkUnavailable: "Check unavailable",
    recheckNeeded: "Recheck needed",
    notCompleted: "Not completed",
    verifyYourSurfAccount: "Verify your Surf account",
    checking2: "Checking…",
    recheck: "Recheck",
    verifySurfAccount: "Verify Surf account",
    lastChecked: "Last checked "
  },
  "zh-TW": {
    retryAfter: (seconds: number) => `請於 ${seconds} 秒後重試。`,
    checking: "確認中",
    signInToRenaissFirst: "請先登入 Renaiss",
    checkYourLinkedRenaissEmail: "請確認 Renaiss 綁定信箱",
    verificationPassed: "驗證通過",
    checkUnavailable: "暫時無法查核",
    recheckNeeded: "請重新驗證",
    notCompleted: "尚未完成",
    verifyYourSurfAccount: "待驗證 Surf 帳號",
    checking2: "查核中…",
    recheck: "重新驗證",
    verifySurfAccount: "驗證 Surf 帳號",
    lastChecked: "上次驗證 "
  },
  "ko": {
    retryAfter: (seconds: number) => `${seconds}초 후 다시 시도해 주세요.`,
    checking: "확인 중",
    signInToRenaissFirst: "먼저 Renaiss에 로그인하세요",
    checkYourLinkedRenaissEmail: "Renaiss에 연결된 이메일을 확인하세요",
    verificationPassed: "인증 완료",
    checkUnavailable: "확인 불가",
    recheckNeeded: "재인증 필요",
    notCompleted: "미완료",
    verifyYourSurfAccount: "Surf 계정을 인증하세요",
    checking2: "확인 중…",
    recheck: "다시 인증",
    verifySurfAccount: "Surf 계정 인증",
    lastChecked: "최근 인증 "
  }
} as const;
