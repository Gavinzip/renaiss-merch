import type { MouseEvent } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { readRenaissLoginUrl, RENAISS_ACCOUNT_SETTINGS_URL } from '../../lib/renaissAuth';
import type { AccountState } from './RenaissHubFeatures';
import './HubAccountAction.css';

export function HubAccountAction({ account, locale, onRetry, disabled }: {
  account: AccountState; locale: AppLocale; onRetry: () => void; disabled: boolean;
}) {
  const zh = locale === 'zh-TW';
  const disabledLink = {
    'aria-disabled': disabled, tabIndex: disabled ? -1 : undefined,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => { if (disabled) event.preventDefault(); }
  };
  const icon = <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="6.5" r="3" /><path d="M4 17v-1.5a6 6 0 0 1 12 0V17" /></svg>;
  if (account.status === 'loading') return <button className="hub-account-action" type="button" disabled aria-busy="true">{icon}<span>{zh ? '確認中' : 'Checking'}</span></button>;
  if (account.status === 'error') return <button className="hub-account-action" type="button" disabled={disabled} onClick={onRetry}>{icon}<span>{zh ? '重新確認' : 'Try again'}</span></button>;
  if (account.session.authenticated) return <a {...disabledLink} className="hub-account-action is-connected" href={RENAISS_ACCOUNT_SETTINGS_URL} target="_blank" rel="noopener noreferrer"
    aria-label={zh ? '我的 Renaiss 帳號' : 'My Renaiss account'} title={account.session.user.name || (zh ? '我的帳號' : 'My account')}>
    {icon}<span>{account.session.user.isDemo ? (zh ? '示範帳號' : 'Demo account') : (zh ? '我的帳號' : 'My account')}</span>
  </a>;
  return <a {...disabledLink} className="hub-account-action is-sign-in" href={readRenaissLoginUrl()} aria-label={zh ? '登入 Renaiss' : 'Sign in to Renaiss'}>
    {icon}<span>{zh ? '登入' : 'Sign in'}</span>
  </a>;
}
