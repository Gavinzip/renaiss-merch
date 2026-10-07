import type { ReactNode } from "react";
import type { AppLocale } from "../../i18n/LocaleContext";
import { HubWordmark } from "./HubWordmark";
import type { RenaissHubCopy } from "./RenaissHubCopy";
import type { HubWidgetCopy } from "./HubWidgetCopy";
import { HubLanguageMenu } from "./HubLanguageMenu";

export function HubHomeIntro({
  navigation,
  accountAction,
  locale,
  setLocale,
  copy,
  widgetsCopy,
  editing,
  saving,
  canCustomize,
  onCustomize,
  onCancel,
  onSave,
}: {
  navigation: ReactNode;
  accountAction: ReactNode;
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  copy: RenaissHubCopy;
  widgetsCopy: HubWidgetCopy;
  editing: boolean;
  saving: boolean;
  canCustomize: boolean;
  onCustomize: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="hub-home-intro">
      <div className="hub-home-intro__utility">
        <div className="hub-home-intro__brand-area">
        <a
          className="renaiss-hub__brand"
          href="#portal-top"
          aria-label="Renaiss"
        >
          <HubWordmark />
        </a>
        </div>
        <div className="hub-home__controls">
          <HubLanguageMenu locale={locale} setLocale={setLocale} />
          {editing ? (
            <>
              <button
                className="hub-home__cancel"
                disabled={saving}
                onClick={onCancel}
                type="button"
              >
                {widgetsCopy.cancel}
              </button>
              <button
                className="renaiss-hub__button hub-home__save"
                disabled={saving}
                onClick={onSave}
                type="button"
              >
                {saving ? widgetsCopy.saving : widgetsCopy.done}
                <svg
                  className="renaiss-hub__arrow"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="m5 10 3 3 7-7" />
                </svg>
              </button>
            </>
          ) : (
            <button
              className="hub-home__customize"
              aria-label={widgetsCopy.customize}
              disabled={!canCustomize}
              onClick={onCustomize}
              type="button"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M3 6h14M3 14h14M7 3v6M13 11v6" />
              </svg>
              <span className="hub-home__customize-label">{widgetsCopy.customize}</span>
            </button>
          )}
          {navigation}
          {accountAction}
        </div>
      </div>
      <span className="hub-home-intro__preview-note">{copy.preview}</span>
    </div>
  );
}
