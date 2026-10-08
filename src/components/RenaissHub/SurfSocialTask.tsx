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
  const zh = locale === 'zh-TW';
  const verified = recorded?.verified === true;
  const outcome = task?.result?.stale ? 'stale' : task?.result?.outcome;
  const linkedX = linkedXUsername?.replace(/^@/, '');
  const identityLocked = task?.identityLocked === true;
  const xLocked = provider === 'x' && identityLocked;
  const xMissing = provider === 'x' && authenticated && !linkedX;
  const reason = authorizationError || task?.result?.reason;
  const xMismatch = provider === 'x' && !verified && ['renaiss_x_mismatch', 'identity_mismatch', 'x_verified_account_locked'].includes(reason || '');
  const displayVerified = verified;
  const label = verified ? (zh ? '驗證通過' : 'Verification passed') : working ? (zh ? '驗證中…' : 'Verifying…') : loading && !recorded ? (zh ? '確認中' : 'Checking') : !authenticated ? (zh ? '登入後查核' : 'Sign in to check') : xMissing ? (zh ? '請先綁定 X' : 'Link X in Renaiss first') : xMismatch ? (zh ? '帳號不同' : 'Account mismatch') : !task?.configured ? (zh ? '暫時無法查核' : 'Check unavailable') :
    outcome === 'incomplete' ? (zh ? '尚未完成' : 'Not completed') :
    outcome === 'pending' ? (zh ? '待確認規則' : 'Screening pending') : outcome === 'stale' ? (zh ? '請重新驗證' : 'Recheck needed') :
    outcome === 'unavailable' ? (zh ? '暫時無法查核' : 'Check unavailable') : outcome === 'reauthorize' ? (zh ? '請重新授權' : 'Reconnect needed') :
    task.connection ? (zh ? '已連接' : 'Connected') : (zh ? '尚未連接' : 'Not connected');
  const connect = Boolean(authorizationError) || !task?.connection || outcome === 'reauthorize';
  const service = provider === 'x' ? 'X' : 'Discord';
  const connectLabel = xMismatch
    ? (xLocked ? (zh ? '使用原帳號授權' : 'Authorize the original account') : (zh ? '更換帳號' : 'Change account'))
    : provider === 'x' && task?.connection && !xLocked
      ? (zh ? '更換帳號' : 'Change account')
    : provider === 'x' && xLocked
      ? (zh ? '重新授權 X' : 'Reauthorize X')
      : (zh ? provider === 'x' ? '授權並驗證 X' : `連接並驗證 ${service}` : `Connect & verify ${service}`);
  const actionLabel = working ? (zh ? '驗證中…' : 'Verifying…') : connect ? connectLabel
    : verified ? (zh ? '重新驗證' : 'Recheck') : (zh ? '驗證任務' : 'Verify task');
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
      {task.connection && !connect && !identityLocked ? <button type="button" className="surf-social-task__change" disabled={busy || loading} onClick={() => act(provider, 'connect')}>{zh ? '更換帳號' : 'Change account'}</button> : null}
    </div> : null}
    {provider === 'x' ? <p className="surf-social-task__detail surf-social-task__account-rule">
      {xMissing ? missionErrorCopy('renaiss_x_not_linked', zh) : zh
        ? `驗證帳號須與 Renaiss 綁定的 X 帳號相同${linkedX ? `（@${linkedX}）` : ''}。`
        : `Verify with the same X account linked to Renaiss${linkedX ? ` (@${linkedX})` : ''}.`}
    </p> : null}
    {xLocked && !verified ? <p className="surf-social-task__detail">{zh ? '此 X 帳號已通過驗證，無法更換。' : 'This verified X account is locked and cannot be changed.'}</p> : null}
    {authenticated && !task?.configured && task?.configurationReason ? <p className="surf-social-task__detail">{missionErrorCopy(task.configurationReason, zh)}</p> : null}
    {reason && !verified && !(xMissing && reason === 'renaiss_x_not_linked') ? <p className="surf-social-task__detail" role={xMismatch ? 'alert' : undefined}>{missionErrorCopy(reason, zh)}</p> : null}
    {task?.result?.checkedAt ? <time className="surf-social-task__time" dateTime={task.result.checkedAt}>
      {zh ? '上次驗證 ' : 'Last checked '}{new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(task.result.checkedAt))}
    </time> : null}
  </div>;
}
