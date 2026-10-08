import type { MouseEvent } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { readRenaissLoginUrl, RENAISS_ACCOUNT_SETTINGS_URL } from '../../lib/renaissAuth';
import type { AccountState } from './RenaissHubFeatures';
import './HubAccountAction.css';

export function HubAccountAction({ account, locale, onRetry, onLogin, onLogout, disabled, loggingOut = false }: {
  account: AccountState; locale: AppLocale; onRetry: () => void; onLogin?: () => void; onLogout?: () => void; disabled: boolean; loggingOut?: boolean;
}) {
  const disabledLink = {
    'aria-disabled': disabled, tabIndex: disabled ? -1 : undefined,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => { if (disabled) event.preventDefault(); }
  };
  const icon = <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="6.5" r="3" /><path d="M4 17v-1.5a6 6 0 0 1 12 0V17" /></svg>;
  if (account.status === 'loading') return <button className="hub-account-action" type="button" disabled aria-busy="true">{icon}<span>{inlineCopy[locale].checking}</span></button>;
  if (account.status === 'error') return <button className="hub-account-action" type="button" disabled={disabled} onClick={onRetry}>{icon}<span>{inlineCopy[locale].tryAgain}</span></button>;
  if (account.session.authenticated) return <div className="hub-account-actions"><a {...disabledLink} className="hub-account-action is-connected" href={RENAISS_ACCOUNT_SETTINGS_URL} target="_blank" rel="noopener noreferrer"
    aria-label={inlineCopy[locale].myRenaissAccount} title={account.session.user.name || (inlineCopy[locale].myAccount)}>
    {icon}<span>{account.session.user.isDemo ? (inlineCopy[locale].demoAccount) : (inlineCopy[locale].myAccount)}</span>
  </a>{onLogout ? <button className="hub-account-action__logout" type="button" onClick={onLogout} disabled={disabled || loggingOut} aria-label={inlineCopy[locale].signOutOfRenaiss}>{loggingOut ? (inlineCopy[locale].signingOut) : (inlineCopy[locale].signOut)}</button> : null}</div>;
  if (onLogin) return <button className="hub-account-action is-sign-in" type="button" onClick={onLogin} disabled={disabled} aria-label={inlineCopy[locale].signInToRenaiss}>
    {icon}<span>{inlineCopy[locale].signIn}</span>
  </button>;
  return <a {...disabledLink} className="hub-account-action is-sign-in" href={readRenaissLoginUrl()} aria-label={inlineCopy[locale].signInToRenaiss}>
    {icon}<span>{inlineCopy[locale].signIn}</span>
  </a>;
}

const inlineCopy = {
  "en": {
    checking: "Checking",
    tryAgain: "Try again",
    myRenaissAccount: "My Renaiss account",
    myAccount: "My account",
    demoAccount: "Demo account",
    signOutOfRenaiss: "Sign out of Renaiss",
    signingOut: "Signing out",
    signOut: "Sign out",
    signInToRenaiss: "Sign in to Renaiss",
    signIn: "Sign in"
  },
  "zh-TW": {
    checking: "確認中",
    tryAgain: "重新確認",
    myRenaissAccount: "我的 Renaiss 帳號",
    myAccount: "我的帳號",
    demoAccount: "示範帳號",
    signOutOfRenaiss: "登出 Renaiss",
    signingOut: "登出中",
    signOut: "登出",
    signInToRenaiss: "登入 Renaiss",
    signIn: "登入"
  },
  "ko": {
    checking: "확인 중",
    tryAgain: "다시 시도",
    myRenaissAccount: "내 Renaiss 계정",
    myAccount: "내 계정",
    demoAccount: "데모 계정",
    signOutOfRenaiss: "Renaiss 로그아웃",
    signingOut: "로그아웃 중",
    signOut: "로그아웃",
    signInToRenaiss: "Renaiss 로그인",
    signIn: "로그인"
  }
} as const;
