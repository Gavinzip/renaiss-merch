import type { AppLocale } from '../../i18n/LocaleContext';
import type { useSurfMissions } from './useSurfMissions';
import { missionErrorCopy } from './missionErrorCopy';
import { SurfEmailWarning } from './SurfEmailWarning';

export function SurfAccountTask({ locale, missions, loading, onLogin }: {
  locale: AppLocale; missions: ReturnType<typeof useSurfMissions>; loading: boolean; onLogin: () => void;
}) {
  const zh = locale === 'zh-TW', account = missions.state?.accounts;
  const stale = account?.stale === true;
  const verified = account?.outcome === 'verified' && !stale;
  const emailWarning = ['renaiss_email_missing', 'renaiss_email_invalid'].includes(account?.reason || '');
  const label = loading ? (zh ? '確認中' : 'Checking') : !missions.state?.authenticated ? (zh ? '請先登入 Renaiss' : 'Sign in to Renaiss first') :
    emailWarning ? (zh ? '請確認 Renaiss 綁定信箱' : 'Check your linked Renaiss email') :
    !account?.configured ? (zh ? '暫時無法查核' : 'Check unavailable') : stale ? (zh ? '請重新驗證' : 'Recheck needed') :
    verified ? (zh ? '雙方帳號已驗證' : 'Both accounts verified') : account.outcome === 'incomplete' ? (zh ? '尚未完成' : 'Not completed') :
    account.outcome === 'unavailable' ? (zh ? '暫時無法查核' : 'Check unavailable') : (zh ? '待驗證 Surf 帳號' : 'Verify your Surf account');
  const disabled = loading || missions.busy !== null;
  return <div className="surf-social-task surf-account-task">
    <div className="surf-social-task__identity" data-surf-reveal="3" aria-live="polite">
      <span className={`surf-social-task__status ${verified ? 'is-verified' : ''}`}>
        {verified ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg> : <i />}{label}
      </span>
      {account?.email ? <span className="surf-social-task__username">{account.email}</span> : null}
    </div>
    {!missions.state?.authenticated ? null : emailWarning ?
      <SurfEmailWarning locale={locale} reason={account?.reason || ''} onLogin={onLogin} disabled={disabled} /> :
      account?.configured && account.emailLinked ? <div className="surf-social-task__controls"><button type="button" disabled={disabled} onClick={missions.verifyAccounts}>
        {missions.busy === 'accounts' ? (zh ? '查核中…' : 'Checking…') : verified || stale ? (zh ? '重新驗證' : 'Recheck') : (zh ? '驗證 Surf 帳號' : 'Verify Surf account')}
      </button></div> : null}
    {missions.state?.authenticated && account?.reason && !emailWarning ? <p className="surf-social-task__detail">{missionErrorCopy(account.reason, zh)}</p> : null}
    {account?.retryAfterSeconds ? <p className="surf-social-task__detail">{zh ? `請於 ${account.retryAfterSeconds} 秒後重試。` : `Retry after ${account.retryAfterSeconds} seconds.`}</p> : null}
    {account?.checkedAt ? <time className="surf-social-task__time" dateTime={account.checkedAt}>{zh ? '上次查核 ' : 'Last checked '}{new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(account.checkedAt))}</time> : null}
  </div>;
}
