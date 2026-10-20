import type { ReactNode } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { HubLanguageMenu } from './HubLanguageMenu';
import { HubWordmark } from './HubWordmark';
import './HubSiteHeader.css';

export function HubSiteHeader({ locale, setLocale, location, onBack, backLabel, navigation, accountAction, actions, editingActions, inert = false }: {
  inert?: boolean;
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  location?: string;
  onBack?: () => void;
  backLabel?: string;
  navigation?: ReactNode;
  accountAction?: ReactNode;
  actions?: ReactNode;
  editingActions?: ReactNode;
}) {
  return <header className="hub-site-header" inert={inert}>
    <div className="hub-site-header__identity">
      {navigation}
      {onBack ? <button className="hub-site-header__back" type="button" onClick={onBack} aria-label={backLabel ?? inlineCopy[locale].backToOverview}>←</button> : null}
      <a className="renaiss-hub__brand" href="#portal-top" onClick={location && onBack ? event => { event.preventDefault(); onBack(); } : undefined} aria-label="Renaiss"><HubWordmark /></a>
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

const inlineCopy = {
  "en": {
    backToOverview: "Back to overview"
  },
  "zh-TW": {
    backToOverview: "返回總覽"
  },
  "ko": {
    backToOverview: "홈으로 돌아가기"
  }
} as const;
