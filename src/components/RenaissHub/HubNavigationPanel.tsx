import type { MouseEvent } from "react";
import type { AppLocale } from "../../i18n/LocaleContext";
import { HubWordmark } from "./HubWordmark";
import { HubLogo } from "./HubLogo";
import { HubLanguageMenu } from "./HubLanguageMenu";

export type HubNavigationPage = "home" | "store" | "campaign" | "events" | "binder" | "verify";

export const navigationCopy = {
  "zh-TW": { open: "展開側邊欄", close: "收合側邊欄", label: "Renaiss 導覽", home: "總覽", binder: "我的收藏冊", quest: "Partner Quest", events: "活動回顧", merch: "Renaiss Merch", preparing: "準備商店中…" },
  ko: { open: "사이드바 펼치기", close: "사이드바 접기", label: "Renaiss 메뉴", home: "홈", binder: "내 바인더", quest: "협업 미션", events: "지난 이벤트", merch: "Renaiss Merch", preparing: "스토어 준비 중…" },
  en: { open: "Expand sidebar", close: "Collapse sidebar", label: "Renaiss navigation", home: "Overview", binder: "My Binder", quest: "Partner Quest", events: "Past events", merch: "Renaiss Merch", preparing: "Preparing Store…" },
};

export function HubNavigationPanel({ locale, setLocale, compact, current, preparing, disabled, onGoHome, onOpenCampaign, onOpenArchive, onOpenBinder, onEnterMerch, onNavigate, onClose }: {
  locale: AppLocale; setLocale: (locale: AppLocale) => void; compact: boolean; current: HubNavigationPage; preparing: boolean; disabled: boolean;
  onOpenBinder: () => void; onGoHome?: () => void; onOpenCampaign: () => void; onOpenArchive: () => void; onEnterMerch: () => void;
  onNavigate: () => void; onClose?: () => void;
}) {
  const copy = navigationCopy[locale];
  function goHome(event: MouseEvent<HTMLAnchorElement>) {
    if (disabled) { event.preventDefault(); return; }
    onNavigate();
    if (onGoHome) { event.preventDefault(); onGoHome(); }
  }

  return <>
    <div className="hub-sidebar__header">
      <a className="hub-sidebar__brand" href="#portal-top" aria-label="Renaiss" aria-disabled={disabled || undefined} onClick={goHome}>
        <span className="hub-sidebar__brand-art">{compact ? <HubLogo /> : <HubWordmark />}</span>
      </a>
      {onClose ? <button className="hub-sidebar__close" type="button" onClick={onClose} aria-label={copy.close} autoFocus><NavigationIcon kind="close" /></button> : null}
    </div>
    <nav className="hub-sidebar__destinations" aria-label={copy.label}>
      <a className="hub-sidebar__destination" href="#portal-top" aria-label={copy.home} title={copy.home}
        aria-current={current === "home" ? "page" : undefined} aria-disabled={disabled || undefined} onClick={goHome}>
        <NavigationIcon kind="home" /><span>{copy.home}</span>
      </a>
      <button className="hub-sidebar__destination" type="button" disabled={disabled} title={copy.quest} aria-label={copy.quest} aria-current={current === "campaign" ? "page" : undefined}
        onClick={() => { onNavigate(); onOpenCampaign(); }}>
        <NavigationIcon kind="quest" /><span>{copy.quest}</span>
      </button>
      <button className="hub-sidebar__destination" type="button" disabled={disabled} title={copy.events} aria-label={copy.events} aria-current={current === "events" ? "page" : undefined}
        onClick={() => { onNavigate(); onOpenArchive(); }}>
        <NavigationIcon kind="events" /><span>{copy.events}</span>
      </button>
      <button className="hub-sidebar__destination" type="button" disabled={disabled} title={copy.binder} aria-label={copy.binder} aria-current={current === "binder" ? "page" : undefined}
        onClick={() => { onNavigate(); onOpenBinder(); }}>
        <NavigationIcon kind="binder" /><span>{copy.binder}</span>
      </button>
      <div className="hub-sidebar__separator" />
      <button className="hub-sidebar__destination" type="button" disabled={disabled || preparing || current === "store"}
        title={copy.merch} aria-label={preparing ? copy.preparing : copy.merch} aria-current={current === "store" ? "page" : undefined}
        onClick={() => { onNavigate(); onEnterMerch(); }}>
        <NavigationIcon kind="merch" /><span>{preparing ? copy.preparing : copy.merch}</span>
      </button>
    </nav>
    <div className="hub-sidebar__footer"><HubLanguageMenu locale={locale} setLocale={setLocale} placement="sidebar" compact={compact} /></div>
  </>;
}

export function NavigationIcon({ kind }: { kind: "home" | "quest" | "events" | "merch" | "sidebar" | "close" | "binder" }) {
  const paths = {
    binder: <><rect x="3" y="2" width="14" height="16" rx="2" /><path d="M7 2v16M10 6h4M10 10h4M10 14h4" /></>,
    home: <><path d="m3 9 7-6 7 6v8h-5v-5H8v5H3Z" /></>,
    quest: <path d="M4 17V3m0 0h6l1 2h5v8h-6l-1-2H4" />,
    events: <><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" /></>,
    merch: <path d="M4 6h12l1 11H3ZM7 6V5a3 3 0 0 1 6 0v1" />,
    sidebar: <><rect x="2.5" y="3" width="15" height="14" rx="1.5" /><path d="M7.5 3v14" /></>,
    close: <path d="m5 5 10 10M15 5 5 15" />,
  };
  return <svg viewBox="0 0 20 20" aria-hidden="true">{paths[kind]}</svg>;
}
