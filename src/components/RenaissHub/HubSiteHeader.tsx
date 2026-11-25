import type { ReactNode } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { HubLanguageMenu } from './HubLanguageMenu';
import { HubWordmark } from './HubWordmark';
import './HubSiteHeader.css';

export function HubSiteHeader({ locale, setLocale, location, onBack, navigation, accountAction, actions, editingActions, brand, inert = false }: {
  inert?: boolean;
  brand?: ReactNode;
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  location?: string;
  onBack?: () => void;
  navigation?: ReactNode;
  accountAction?: ReactNode;
  actions?: ReactNode;
  editingActions?: ReactNode;
}) {
  return <header className="hub-site-header" inert={inert}>
    <div className="hub-site-header__identity">
      {navigation}
      <a className="renaiss-hub__brand" href="#portal-top" onClick={location && onBack ? event => { event.preventDefault(); onBack(); } : undefined} aria-label="Renaiss">{brand ?? <HubWordmark />}</a>
      {location ? <span className="hub-site-header__location">/ {location}</span> : null}
    </div>
    <div className="hub-home__controls hub-site-header__controls">
      {!navigation ? <HubLanguageMenu locale={locale} setLocale={setLocale} /> : null}
      {editingActions}
      {actions}
      {accountAction}
    </div>
  </header>;
}
