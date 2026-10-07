import { missionErrorCopy } from './missionErrorCopy';
import type { AppLocale } from '../../i18n/LocaleContext';
import type { SocialProvider, SocialTaskState } from './useSurfMissions';

export function SurfSocialTask({ provider, task, authenticated, busy, working, loading, locale, act, onLogin }: {
  provider: SocialProvider; task?: SocialTaskState; authenticated: boolean; busy: boolean; working: boolean; loading: boolean;
  locale: AppLocale; act: (provider: SocialProvider, action: 'connect' | 'verify') => void; onLogin: () => void;
}) {
  const zh = locale === 'zh-TW';
  const outcome = task?.result?.stale ? 'stale' : task?.result?.outcome;
  const label = loading ? (zh ? '確認中' : 'Checking') : !task?.configured ? (zh ? '設定中' : 'Setup pending') :
    outcome === 'verified' ? (zh ? '已驗證' : 'Verified') : outcome === 'incomplete' ? (zh ? '尚未完成' : 'Not completed') :
    outcome === 'pending' ? (zh ? '待確認規則' : 'Screening pending') : outcome === 'stale' ? (zh ? '請重新驗證' : 'Recheck needed') :
    outcome === 'unavailable' ? (zh ? '暫時無法查核' : 'Check unavailable') : outcome === 'reauthorize' ? (zh ? '請重新授權' : 'Reconnect needed') :
    task.connection ? (zh ? '已連接' : 'Connected') : (zh ? '尚未連接' : 'Not connected');
  const connect = !task?.connection || outcome === 'reauthorize';
  const service = provider === 'x' ? 'X' : 'Discord';
  return <div className="surf-social-task">
    <div className="surf-social-task__identity" data-surf-reveal="3" aria-live="polite">
      <span className={`surf-social-task__status ${outcome === 'verified' ? 'is-verified' : ''}`}>
        {outcome === 'verified' ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg> : <i />}{label}
      </span>
      {task?.connection ? <span className="surf-social-task__username">{provider === 'x' ? '@' : ''}{task.connection.username}</span> : null}
    </div>
    {!authenticated ? <div className="surf-social-task__controls" data-surf-reveal="4"><button type="button" disabled={busy || loading} onClick={onLogin}>{zh ? `登入以連接 ${service}` : `Sign in to connect ${service}`}</button></div> : task?.configured ? <div className="surf-social-task__controls" data-surf-reveal="4">
      <button type="button" disabled={busy || loading} onClick={() => act(provider, connect ? 'connect' : 'verify')}>
        {working ? (zh ? '查核中…' : 'Checking…') : connect ? (zh ? `連接 ${service}` : `Connect ${service}`) : outcome === 'verified' ? (zh ? '重新驗證' : 'Recheck') : (zh ? '驗證任務' : 'Verify task')}
      </button>
      {task.connection && !connect ? <button type="button" className="surf-social-task__change" disabled={busy || loading} onClick={() => act(provider, 'connect')}>{zh ? '更換帳號' : 'Change account'}</button> : null}
    </div> : null}
    {!task?.connection ? <p className="surf-social-task__hint" data-surf-reveal="5">{zh ? provider === 'x' ? '先登入 Renaiss，再授權 X 讀取追蹤關係，確認是否追蹤 Surf。' : '先登入 Renaiss，再授權 Discord 確認是否加入 Surf 社群。' : provider === 'x' ? 'Sign in to Renaiss, then authorize X to check whether you follow Surf.' : 'Sign in to Renaiss, then authorize Discord to check your Surf membership.'}</p> : null}
    {task?.result?.reason ? <p className="surf-social-task__detail">{missionErrorCopy(task.result.reason, zh)}</p> : null}
    {task?.result?.checkedAt ? <time className="surf-social-task__time" dateTime={task.result.checkedAt}>
      {zh ? '上次查核 ' : 'Last checked '}{new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(task.result.checkedAt))}
    </time> : null}
  </div>;
}
