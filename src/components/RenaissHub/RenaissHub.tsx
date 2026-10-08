import "./RenaissHubStyles";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocale } from "../../i18n/LocaleContext";
import { readRenaissSession, signOutRenaiss, startRenaissLogin } from "../../lib/renaissAuth";
import { staticMerchAssetCssUrl } from "../../lib/staticAssets";
import type { AccountState } from "./RenaissHubFeatures";
import { HubWidgetContent } from "./HubWidgetContent";
import { renaissHubCopy } from "./RenaissHubCopy";
import {
  createDefaultHubPreferences,
  type HubPreferences,
  type HubWidget,
} from "../../../shared/hub-preferences.js";
import { hubWidgetCopy } from "./HubWidgetCopy";
import { useHubPreferences } from "./useHubPreferences";
import { useCommunityFeed } from "./useCommunityFeed";
import { HubWidgetFrame } from "./HubWidgetEditor";
import { HubWidgetLibrary } from "./HubWidgetLibrary";
import { useHubWidgetMotion } from "./useHubWidgetMotion";
import { useHubWidgetDrag } from "./useHubWidgetDrag";
import { HubHomeIntro } from "./HubHomeIntro";
import { HubAssistant } from "./HubAssistant";
import { HubNavigation } from "./HubNavigation";
import { HubAccountAction } from "./HubAccountAction";
import { SurfCampaignPage } from "./SurfCampaignPage";
import { useHubCampaignRoute } from "./useHubCampaignRoute";
import { useHubInitialReadiness } from './useHubInitialReadiness';
import { HubPageLoading } from './HubPageLoading';
import { editableHubLayout, visibleHubLayout } from "./hubLayout";


type RenaissHubProps = {
  loadProgress: number;
  loadState: "idle" | "loading" | "error";
  onEnterMerch: () => void;
  showPreviewNote?: boolean;
  showAssistant?: boolean;
};

export function RenaissHub({
  loadProgress,
  loadState,
  onEnterMerch,
  showPreviewNote = true,
  showAssistant = false,
}: RenaissHubProps) {
  const { locale, setLocale } = useLocale();
  const copy = renaissHubCopy[locale];
  const campaignRoute = useHubCampaignRoute();
  const [account, setAccount] = useState<AccountState>({ status: "loading" });
  const [accountRequest, setAccountRequest] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [enterRequested, setEnterRequested] = useState(false);
  const [draft, setDraft] = useState<HubPreferences | null>(null);
  const [restoreSelection, setRestoreSelection] = useState<HubWidget | null>(null);
  const widgetsCopy = hubWidgetCopy[locale];
  const settings = useHubPreferences(account);
  const preferences = visibleHubLayout(draft || settings.preferences);
  const editing = draft !== null;
  const visibleWidgets = preferences.widgets;
  const feed = useCommunityFeed(
    locale,
    editing || preferences.widgets.some((widget) => widget.type === "feed"),
  );
  const overviewRef = useRef<HTMLElement>(null);
  const initialReadiness = useHubInitialReadiness(account, settings.status, feed.state, overviewRef);
  const widgetMotion = useHubWidgetMotion(preferences.widgets, editing);

  const [moveAnnouncement, setMoveAnnouncement] = useState("");
  const widgetDrag = useHubWidgetDrag({
    gridRef: widgetMotion.gridRef,
    widgets: preferences.widgets,
    editing,
    onReorder: reorderWidget,
    onRestoreOrder: (ids) => updateWidgets((widgets) =>
      [...widgets].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)),
    ),
    onSettle: widgetMotion.settleLayout,
    onPickUp: widgetMotion.cancelMotion,
  });

  function updateWidgets(update: (widgets: HubWidget[]) => HubWidget[]) {
    widgetMotion.captureLayout();
    setDraft((current) =>
      current ? { ...current, layout: "custom", widgets: update(current.widgets) } : null,
    );
  }

  function moveWidget(index: number, direction: -1 | 1) {
    const position = index + direction;
    if (position < 0 || position >= preferences.widgets.length) return;
    announceMove(preferences.widgets[index], position, preferences.widgets.length);
    updateWidgets((widgets) => {
      if (index + direction < 0 || index + direction >= widgets.length) return widgets;
      const next = [...widgets];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
  }

  function announceMove(widget: HubWidget, index: number, total: number) {
    const name = widget.type === "feed" ? widgetsCopy.sources[widget.source] : widgetsCopy.widgets[widget.type];
    setMoveAnnouncement(`${name} · ${index + 1} / ${total}`);
  }

  function reorderWidget(id: string, target: string) {
    const widget = preferences.widgets.find((item) => item.id === id);
    const position = preferences.widgets.findIndex((item) => item.id === target);
    if (!widget || position < 0) return;
    announceMove(widget, position, preferences.widgets.length);
    updateWidgets((widgets) => {
      const from = widgets.findIndex((widget) => widget.id === id);
      const to = widgets.findIndex((widget) => widget.id === target);
      if (from < 0 || to < 0 || from === to) return widgets;
      const next = [...widgets];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function enterMerch() {
    setEnterRequested(true);
    onEnterMerch();
  }

  function renderWidget(widget: HubWidget, preview = false) {
    return <HubWidgetContent widget={widget} locale={locale} account={account} feed={feed.state}
      onRetryFeed={feed.retry} onRetryAccount={retryAccount} onLogin={() => startRenaissLogin()}
      preview={preview} editing={editing}
      enterRequested={enterRequested} loadProgress={loadProgress} loadState={loadState}
      onEnter={enterMerch} onOpenCampaign={campaignRoute.open} />;
  }

  function retryAccount() {
    setAccount({ status: "loading" });
    setAccountRequest((current) => current + 1);
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(false);
    try {
      await signOutRenaiss();
      setAccount({ status: 'ready', session: { authenticated: false } });
      setDraft(null);
    } catch {
      setLogoutError(true);
    } finally {
      setLoggingOut(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void readRenaissSession()
      .then((session) => {
        if (!cancelled) setAccount({ status: "ready", session });
      })
      .catch(() => {
        if (!cancelled) setAccount({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [accountRequest]);

  return (
    <div className="hub-route-motion" ref={campaignRoute.ref} data-route-motion="true" data-route-transitioned={campaignRoute.hasTransitioned} data-route-busy={campaignRoute.busy} inert={campaignRoute.busy}>
    {campaignRoute.active ? <SurfCampaignPage locale={locale} setLocale={setLocale} account={account} motionRevision={campaignRoute.revision} onBack={campaignRoute.back} onLogin={() => startRenaissLogin()} onRetry={retryAccount} onLogout={() => void logout()} loggingOut={loggingOut} /> : <main
      ref={overviewRef}
      className="renaiss-hub"
      data-initial-ready={initialReadiness === 'ready'}
      id="portal-top"
      aria-label={inlineCopy[locale].renaissDashboard}
      data-layout={preferences.layout}
      data-density={preferences.density || "comfortable"}
      data-editing={editing}
      lang={locale}
      style={
        {
          "--renaiss-hub-background": staticMerchAssetCssUrl("storeBackground"),
        } as CSSProperties
      }
    >
      <div className="renaiss-hub__content">
        <HubHomeIntro
      accountAction={<><HubAccountAction account={account} locale={locale} onRetry={retryAccount} onLogout={() => void logout()} loggingOut={loggingOut} disabled={editing || settings.saving} />{logoutError ? <span className="hub-site-header__error" role="alert">{inlineCopy[locale].signOutFailedTryAgain}</span> : null}</>}
          navigation={<HubNavigation locale={locale} onOpenCampaign={campaignRoute.open} onEnterMerch={enterMerch} preparing={enterRequested && loadState === "loading"} disabled={editing || settings.saving} />}
          locale={locale}
          setLocale={setLocale}
          copy={copy}
          widgetsCopy={widgetsCopy}
          showPreviewNote={showPreviewNote}
          editing={editing}
          saving={settings.saving}
          canCustomize={settings.status === "ready"}
          onCustomize={() => {
            widgetMotion.captureLayout();
            setRestoreSelection(null);
            setDraft(editableHubLayout(settings.preferences));
          }}
          onCancel={() => {
            widgetMotion.captureLayout();
            setDraft(null);
          }}
          onSave={() => {
            void settings.save(preferences).then((saved) => {
              if (saved) {
                widgetMotion.captureLayout();
                setDraft(null);
              }
            });
          }}
        />
        {settings.status === "loading" ? (
          <p className="hub-home__notice" role="status">
            {widgetsCopy.loadingPreferences}
          </p>
        ) : settings.status === "error" ? (
          <div className="hub-home__notice" role="alert">
            <p>{widgetsCopy.preferencesError}</p>
            <button
              type="button"
              onClick={
                account.status === "error" ? retryAccount : settings.retry
              }
            >
              {widgetsCopy.retry}
            </button>
            {account.status === "ready" ? (
              <button
                type="button"
                disabled={settings.saving}
                onClick={() => {
                  void settings.save(createDefaultHubPreferences());
                }}
              >
                {widgetsCopy.restore}
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {editing ? (
              <HubWidgetLibrary
                onRestoreDefault={() => {
                  widgetMotion.captureLayout();
                  setRestoreSelection(null);
                  setDraft(editableHubLayout(createDefaultHubPreferences()));
                }}
                preferences={preferences}
                copy={widgetsCopy}
                restoreSelection={restoreSelection}
                renderPreview={(widget) => renderWidget(widget, true)}
                onUpdate={(next) => updateWidgets(widgets => widgets.map(widget => widget.id === next.id ? next : widget))}
                disabled={settings.saving}
                onAdd={(widget) =>
                  updateWidgets((widgets) => [...widgets, widget])
                }
              />
            ) : null}
            {settings.saveError ? (
              <p
                className="hub-home__notice hub-home__notice--error"
                role="alert"
              >
                {widgetsCopy.saveError}
              </p>
            ) : null}
            <section
              ref={widgetMotion.gridRef}
              className="renaiss-hub__dashboard"
              data-motion-paused={widgetMotion.paused || settings.saving}
              aria-label={copy.dashboardLabel}
              aria-busy={settings.saving}
              inert={settings.saving}
              onPointerMove={widgetDrag.move}
              onPointerUp={widgetDrag.end}
              onPointerCancel={widgetDrag.cancel}
              onLostPointerCapture={widgetDrag.cancel}
            >
              {visibleWidgets.map((widget, index) => (
                <HubWidgetFrame
                  key={widget.id}
                  widget={widget}
                  index={index}
                  total={preferences.widgets.length}
                  editing={editing}
                  copy={widgetsCopy}
                  drag={widgetDrag.drag?.id === widget.id ? widgetDrag.drag : null}
                  onDragStart={(event, handle) => widgetDrag.start(widget.id, event, handle)}
                  onMove={(direction) => moveWidget(index, direction)}
                  onHide={() => {
                    updateWidgets((widgets) => widgets.filter((item) => item.id !== widget.id));
                  }}
                  onSettings={(next) =>
                    updateWidgets((widgets) =>
                      widgets.map((item) =>
                        item.id === widget.id ? next : item,
                      ),
                    )
                  }
                >
                  {renderWidget(widget)}
                </HubWidgetFrame>
              ))}
            </section>
            {editing ? (
              <><p className="hub-visually-hidden" id="hub-widget-drag-hint">{widgetsCopy.dragHint}</p>
              <p className="hub-visually-hidden" role="status">{moveAnnouncement}</p>
              <p className="hub-home__storage">
                {settings.accountStorage
                  ? widgetsCopy.accountStorage
                  : widgetsCopy.localStorage}
              </p></>
            ) : null}
          </>
        )}
        <footer className="renaiss-hub__footer">
          <span>{copy.footer}</span>
          <span>RENAISS / 2026</span>
        </footer>
      </div>
      {showAssistant ? <HubAssistant locale={locale} disabled={editing || settings.saving} /> : null}
      <HubPageLoading className="renaiss-hub__initial-overlay" locale={locale} ready={initialReadiness === 'ready'} error={initialReadiness === 'error'} onRetry={() => window.location.reload()} />
    </main>}
    </div>
  );
}

const inlineCopy = {
  "en": {
    renaissDashboard: "Renaiss dashboard",
    signOutFailedTryAgain: "Sign out failed. Try again."
  },
  "zh-TW": {
    renaissDashboard: "Renaiss 總覽",
    signOutFailedTryAgain: "登出失敗，請重試"
  },
  "ko": {
    renaissDashboard: "Renaiss 홈",
    signOutFailedTryAgain: "로그아웃하지 못했습니다. 다시 시도해 주세요."
  }
} as const;
