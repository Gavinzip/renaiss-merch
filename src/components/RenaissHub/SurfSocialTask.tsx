import { missionErrorCopy } from './missionErrorCopy';
import type { AppLocale } from '../../i18n/LocaleContext';
import type { RecordedMissionTask, SocialProvider, SocialTaskState } from './useSurfMissions';

export function SurfSocialTask({ provider, task, recorded, linkedXUsername, authorizationError, authenticated, busy, working, loading, locale, act }: {
  recorded?: RecordedMissionTask;
  linkedXUsername?: string | null;
  authorizationError?: string | null;
  provider: SocialProvider; task?: SocialTaskState; authenticated: boolean; busy: boolean; working: boolean; loading: boolean;
  locale: AppLocale; act: (provider: SocialProvider, action: 'connect' | 'verify') => void;
}) {
  const verified = recorded?.verified === true;
  const outcome = task?.result?.stale ? 'stale' : task?.result?.outcome;
  const linkedX = linkedXUsername?.replace(/^@/, '');
  const identityLocked = task?.identityLocked === true;
  const xLocked = provider === 'x' && identityLocked;
  const xMissing = provider === 'x' && authenticated && !linkedX;
  const reason = authorizationError || task?.result?.reason;
  const xMismatch = provider === 'x' && !verified && ['renaiss_x_mismatch', 'identity_mismatch', 'x_verified_account_locked'].includes(reason || '');
  const displayVerified = verified;
  const label = verified ? (inlineCopy[locale].verificationPassed) : working ? (inlineCopy[locale].verifying) : loading && !recorded ? (inlineCopy[locale].checking) : !authenticated ? (inlineCopy[locale].signInToCheck) : xMissing ? (inlineCopy[locale].linkXInRenaissFirst) : xMismatch ? (inlineCopy[locale].accountMismatch) : !task?.configured ? (inlineCopy[locale].checkUnavailable) :
    outcome === 'incomplete' ? (inlineCopy[locale].notCompleted) :
    outcome === 'pending' ? (inlineCopy[locale].screeningPending) : outcome === 'stale' ? (inlineCopy[locale].recheckNeeded) :
    outcome === 'unavailable' ? (inlineCopy[locale].checkUnavailable) : outcome === 'reauthorize' ? (inlineCopy[locale].reconnectNeeded) :
    task.connection ? (inlineCopy[locale].connected) : (inlineCopy[locale].notConnected);
  const connect = Boolean(authorizationError) || !task?.connection || outcome === 'reauthorize';
  const service = provider === 'x' ? 'X' : 'Discord';
  const connectLabel = xMismatch
    ? (xLocked ? (inlineCopy[locale].authorizeTheOriginalAccount) : (inlineCopy[locale].changeAccount))
    : provider === 'x' && task?.connection && !xLocked
      ? (inlineCopy[locale].changeAccount)
    : provider === 'x' && xLocked
      ? (inlineCopy[locale].reauthorizeX)
      : inlineCopy[locale].connectService(service);
  const actionLabel = working ? (inlineCopy[locale].verifying) : connect ? connectLabel
    : verified ? (inlineCopy[locale].recheck) : (inlineCopy[locale].verifyTask);
  return <div className="surf-social-task" data-verified={verified}>
    <div className="surf-social-task__identity" data-surf-reveal="3" aria-live="polite">
      <span className={`surf-social-task__status ${displayVerified ? 'is-verified' : ''}`}>
        {displayVerified ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg> : <i />}{label}
      </span>
      {task?.connection ? <span className="surf-social-task__username">{provider === 'x' ? '@' : ''}{task.connection.username}</span> : null}
    </div>
    {authenticated && task?.configured && !xMissing && !verified ? <div className="surf-social-task__controls" data-surf-reveal="4">
      <button type="button" disabled={busy || loading} onClick={() => act(provider, connect ? 'connect' : 'verify')}>
        {actionLabel}
      </button>
      {task.connection && !connect && !identityLocked ? <button type="button" className="surf-social-task__change" disabled={busy || loading} onClick={() => act(provider, 'connect')}>{inlineCopy[locale].changeAccount}</button> : null}
    </div> : null}
    {provider === 'x' ? <p className="surf-social-task__detail surf-social-task__account-rule">
      {xMissing ? missionErrorCopy('renaiss_x_not_linked', locale) : inlineCopy[locale].sameXAccount(linkedX)}
    </p> : null}
    {xLocked && !verified ? <p className="surf-social-task__detail">{inlineCopy[locale].thisVerifiedXAccountIsLockedAnd}</p> : null}
    {authenticated && !task?.configured && task?.configurationReason ? <p className="surf-social-task__detail">{missionErrorCopy(task.configurationReason, locale)}</p> : null}
    {reason && !verified && !(xMissing && reason === 'renaiss_x_not_linked') ? <p className="surf-social-task__detail" role={xMismatch ? 'alert' : undefined}>{missionErrorCopy(reason, locale)}</p> : null}
    {task?.result?.checkedAt ? <time className="surf-social-task__time" dateTime={task.result.checkedAt}>
      {inlineCopy[locale].lastChecked}{new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(task.result.checkedAt))}
    </time> : null}
  </div>;
}

const inlineCopy = {
  "en": {
    connectService: (service: string) => `Connect & verify ${service}`,
    sameXAccount: (username?: string) => `Verify with the same X account linked to Renaiss${username ? ` (@${username})` : ''}.`,
    verificationPassed: "Verification passed",
    verifying: "Verifying…",
    checking: "Checking",
    signInToCheck: "Sign in to check",
    linkXInRenaissFirst: "Link X in Renaiss first",
    accountMismatch: "Account mismatch",
    checkUnavailable: "Check unavailable",
    notCompleted: "Not completed",
    screeningPending: "Screening pending",
    recheckNeeded: "Recheck needed",
    reconnectNeeded: "Reconnect needed",
    connected: "Connected",
    notConnected: "Not connected",
    authorizeTheOriginalAccount: "Authorize the original account",
    changeAccount: "Change account",
    reauthorizeX: "Reauthorize X",
    recheck: "Recheck",
    verifyTask: "Verify task",
    thisVerifiedXAccountIsLockedAnd: "This verified X account is locked and cannot be changed.",
    lastChecked: "Last checked "
  },
  "zh-TW": {
    connectService: (service: string) => service === 'X' ? '授權並驗證 X' : `連接並驗證 ${service}`,
    sameXAccount: (username?: string) => `驗證帳號須與 Renaiss 綁定的 X 帳號相同${username ? `（@${username}）` : ''}。`,
    verificationPassed: "驗證通過",
    verifying: "驗證中…",
    checking: "確認中",
    signInToCheck: "登入後查核",
    linkXInRenaissFirst: "請先綁定 X",
    accountMismatch: "帳號不同",
    checkUnavailable: "暫時無法查核",
    notCompleted: "尚未完成",
    screeningPending: "待確認規則",
    recheckNeeded: "請重新驗證",
    reconnectNeeded: "請重新授權",
    connected: "已連接",
    notConnected: "尚未連接",
    authorizeTheOriginalAccount: "使用原帳號授權",
    changeAccount: "更換帳號",
    reauthorizeX: "重新授權 X",
    recheck: "重新驗證",
    verifyTask: "驗證任務",
    thisVerifiedXAccountIsLockedAnd: "此 X 帳號已通過驗證，無法更換。",
    lastChecked: "上次驗證 "
  },
  "ko": {
    connectService: (service: string) => `${service} 연결 및 인증`,
    sameXAccount: (username?: string) => `Renaiss에 연결된 동일한 X 계정${username ? ` (@${username})` : ''}으로 인증해 주세요.`,
    verificationPassed: "인증 완료",
    verifying: "인증 중…",
    checking: "확인 중",
    signInToCheck: "로그인 후 확인",
    linkXInRenaissFirst: "먼저 Renaiss에서 X를 연결하세요",
    accountMismatch: "계정이 다릅니다",
    checkUnavailable: "확인 불가",
    notCompleted: "미완료",
    screeningPending: "서버 규칙 확인 필요",
    recheckNeeded: "재인증 필요",
    reconnectNeeded: "다시 연결해 주세요",
    connected: "연결됨",
    notConnected: "연결되지 않음",
    authorizeTheOriginalAccount: "기존 계정으로 인증",
    changeAccount: "계정 변경",
    reauthorizeX: "X 다시 연결",
    recheck: "다시 인증",
    verifyTask: "미션 인증",
    thisVerifiedXAccountIsLockedAnd: "인증된 X 계정은 변경할 수 없습니다.",
    lastChecked: "최근 인증 "
  }
} as const;
