import type { ReactNode } from "react";
import type { AppLocale } from "../../i18n/LocaleContext";
import { HubSiteHeader } from "./HubSiteHeader";
import type { RenaissHubCopy } from "./RenaissHubCopy";
import type { HubWidgetCopy } from "./HubWidgetCopy";

export function HubHomeIntro({
  navigation,
  accountAction,
  locale,
  setLocale,
  copy,
  widgetsCopy,
  showPreviewNote,
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
  showPreviewNote: boolean;
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
        <HubSiteHeader locale={locale} setLocale={setLocale} navigation={navigation} accountAction={accountAction} editingActions={editing ? (
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
          )} />
      </div>
      {showPreviewNote ? <span className="hub-home-intro__preview-note">{copy.preview}</span> : null}
    </div>
  );
}
