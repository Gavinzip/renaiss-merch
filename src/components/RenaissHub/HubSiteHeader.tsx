import type { ReactNode } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { HubLanguageMenu } from './HubLanguageMenu';
import { HubWordmark } from './HubWordmark';
import './HubSiteHeader.css';

export function HubSiteHeader({ locale, setLocale, location, onBack, navigation, accountAction, actions, editingActions }: {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  location?: string;
  onBack?: () => void;
  navigation?: ReactNode;
  accountAction?: ReactNode;
  actions?: ReactNode;
  editingActions?: ReactNode;
}) {
  return <header className="hub-site-header">
    <div className="hub-site-header__identity">
      {onBack ? <button className="hub-site-header__back" type="button" onClick={onBack} aria-label={locale === 'zh-TW' ? '返回總覽' : 'Back to overview'}>←</button> : null}
      <a className="renaiss-hub__brand" href="#portal-top" onClick={location && onBack ? event => { event.preventDefault(); onBack(); } : undefined} aria-label="Renaiss"><HubWordmark /></a>
      {location ? <span className="hub-site-header__location">/ {location}</span> : null}
    </div>
    <div className="hub-home__controls hub-site-header__controls">
      <HubLanguageMenu locale={locale} setLocale={setLocale} />
      {editingActions}
      {navigation}
      {actions}
      {accountAction}
    </div>
  </header>;
}
