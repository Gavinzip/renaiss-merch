import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { AppLocale } from "../../i18n/LocaleContext";
import { staticMerchAssetCssUrl } from "../../lib/staticAssets";
import { HubNavigationPanel, NavigationIcon, navigationCopy } from "./HubNavigationPanel";
import type { HubNavigationPage } from "./HubNavigationPanel";
import { useHubNavigationState } from "./HubNavigationState";
import "./HubNavigation.css";

const desktopSidebarQuery = "(min-width: 1024px)";

export function HubNavigation({ locale, setLocale, onOpenCampaign, onOpenArchive, onEnterMerch, onGoHome, current = "home", preparing, disabled }: {
  locale: AppLocale; setLocale: (locale: AppLocale) => void; onOpenCampaign: () => void; onEnterMerch: () => void;
  onOpenArchive: () => void; onGoHome?: () => void; current?: HubNavigationPage;
  preparing: boolean; disabled: boolean;
}) {
  const copy = navigationCopy[locale];
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [desktop, setDesktop] = useState(() => window.matchMedia(desktopSidebarQuery).matches);
  const { collapsed, toggle, busy: pageBusy } = useHubNavigationState();
  const [open, setOpen] = useState(false);
  const expanded = desktop ? !collapsed : open;
  const close = () => dialog.current?.close();
  const sidebarBackground = { "--hub-sidebar-background": staticMerchAssetCssUrl("storeBackground") } as CSSProperties;

  useEffect(() => {
    const query = window.matchMedia(desktopSidebarQuery);
    const sync = () => {
      dialog.current?.close();
      setOpen(false);
      setDesktop(query.matches);
    };
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => { if (disabled) dialog.current?.close(); }, [disabled]);

  useEffect(() => {
    if (!open || desktop) return;
    const { overflow, paddingRight } = document.body.style;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const currentPadding = getComputedStyle(document.body).paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = "calc(" + currentPadding + " + " + scrollbarWidth + "px)";
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [open, desktop]);

  const panel = <HubNavigationPanel locale={locale} setLocale={setLocale} compact={desktop && collapsed} current={current} preparing={preparing} disabled={disabled || pageBusy}
    onGoHome={onGoHome} onOpenCampaign={onOpenCampaign} onOpenArchive={onOpenArchive} onEnterMerch={onEnterMerch}
    onNavigate={close} onClose={desktop ? undefined : close} />;

  return <div className="hub-navigation" data-desktop={desktop} data-expanded={expanded}>
    <button className="hub-navigation__trigger" data-campaign-entry="navigation" ref={trigger} type="button" disabled={disabled || pageBusy}
      aria-label={expanded ? copy.close : copy.open} aria-expanded={expanded} aria-controls={panelId}
      aria-haspopup={desktop ? undefined : "dialog"}
      onClick={() => {
        if (desktop) toggle();
        else { dialog.current?.showModal(); setOpen(true); }
      }}>
      <NavigationIcon kind="sidebar" />
    </button>
    {createPortal(desktop
      ? <aside id={panelId} className="hub-sidebar t-resize" data-collapsed={collapsed} aria-label={copy.label} lang={locale} style={sidebarBackground} inert={pageBusy}>{panel}</aside>
      : <dialog id={panelId} ref={dialog} className="hub-navigation__dialog" aria-label={copy.label} lang={locale}
          onClose={() => { setOpen(false); trigger.current?.focus(); }}
          onClick={event => { if (event.target === event.currentTarget) close(); }}>
          <div className="hub-sidebar hub-sidebar--drawer" style={sidebarBackground}>{panel}</div>
        </dialog>, document.body)}
  </div>;
}
