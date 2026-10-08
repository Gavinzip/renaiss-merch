import { useEffect, useId, useRef, useState } from "react";
import type { AppLocale } from "../../i18n/LocaleContext";
import './HubNavigation.css';

const navigationCopy = {
  "zh-TW": { open: "開啟導覽", close: "收起導覽", label: "探索", current: "目前頁面", home: "總覽", homeHint: "帳號、收藏與動態", quest: "Partner Quest", questHint: "合作活動與獎品", merch: "Renaiss Merch", merchHint: "會員限定收藏", preparing: "準備商店中…" },
  ko: { open: "메뉴 열기", close: "메뉴 닫기", label: "둘러보기", current: "현재 페이지", home: "홈", homeHint: "계정, 컬렉션과 소식", quest: "협업 미션", questHint: "활동과 경품", merch: "Renaiss Merch", merchHint: "회원 한정 컬렉션", preparing: "스토어 준비 중…" },
  en: { open: "Open navigation", close: "Close navigation", label: "Explore", current: "You’re here", home: "Overview", homeHint: "Account, collections & updates", quest: "Partner Quest", questHint: "Campaigns & prizes", merch: "Renaiss Merch", merchHint: "Members’ editions", preparing: "Preparing Store…" },
};

export function HubNavigation({ locale, onOpenCampaign, onEnterMerch, onGoHome, current = 'home', preparing, disabled }: {
  locale: AppLocale; onOpenCampaign: () => void; onEnterMerch: () => void;
  onGoHome?: () => void; current?: 'home' | 'store';
  preparing: boolean; disabled: boolean;
}) {
  const copy = navigationCopy[locale];
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const open = phase === "open" && !disabled;
  const close = () => setPhase("closing");

  useEffect(() => { if (disabled) setPhase("closed"); }, [disabled]);

  useEffect(() => {
    if (phase !== "closing" || !panel.current) return;
    const duration = getComputedStyle(panel.current).getPropertyValue("--dropdown-close-dur").trim();
    const milliseconds = Number.parseFloat(duration) * (duration.endsWith("ms") ? 1 : 1000);
    if (!Number.isFinite(milliseconds)) throw new Error("Missing navigation transition duration");
    const timer = window.setTimeout(() => setPhase("closed"), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : milliseconds);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setPhase("closing"); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPhase("closing");
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <div className="hub-navigation" ref={root} onBlur={event => {
    if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) close();
  }}>
    <button className="hub-navigation__trigger" data-campaign-entry="navigation" ref={trigger} type="button" disabled={disabled}
      aria-label={open ? copy.close : copy.open} aria-expanded={open} aria-controls={panelId}
      onClick={() => setPhase(open ? "closing" : "open")}>
      <NavigationIcon kind="explore" />
      <span className="hub-navigation__label">{copy.label}</span>
      <svg className="hub-navigation__chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
    </button>
    <nav id={panelId} ref={panel} className={`hub-navigation__panel ${open ? "is-open" : phase === "closing" ? "is-closing" : ""}`}
      style={{ visibility: phase === "closed" || disabled ? "hidden" : "visible" }}
      data-origin="top-right" aria-label="Renaiss" aria-hidden={!open} inert={!open}>
      <div className="hub-navigation__destinations">
        <a className="hub-navigation__destination" href="#portal-top" aria-current={current === 'home' ? 'page' : undefined} onClick={event => { if (onGoHome) { event.preventDefault(); onGoHome(); } trigger.current?.focus(); close(); }}>
          <span className="hub-navigation__icon"><NavigationIcon kind="home" /></span>
          <span className="hub-navigation__copy"><span className="hub-navigation__title">{copy.home}</span><small>{copy.homeHint}</small></span>
          {current === 'home' ? <span className="hub-navigation__current">{copy.current}</span> : <NavigationIcon kind="arrow" />}
        </a>
        <button className="hub-navigation__destination" type="button" onClick={() => { trigger.current?.focus(); close(); onOpenCampaign(); }}>
          <span className="hub-navigation__icon"><NavigationIcon kind="quest" /></span>
          <span className="hub-navigation__copy"><span className="hub-navigation__title">{copy.quest}</span><small>{copy.questHint}</small></span>
          <NavigationIcon kind="arrow" />
        </button>
        <button className="hub-navigation__destination" type="button" disabled={preparing || current === 'store'} aria-current={current === 'store' ? 'page' : undefined} onClick={() => { trigger.current?.focus(); close(); onEnterMerch(); }}>
          <span className="hub-navigation__icon"><NavigationIcon kind="merch" /></span>
          <span className="hub-navigation__copy"><span className="hub-navigation__title">{preparing ? copy.preparing : copy.merch}</span><small>{copy.merchHint}</small></span>
          {current === 'store' ? <span className="hub-navigation__current">{copy.current}</span> : <NavigationIcon kind="arrow" />}
        </button>
      </div>
    </nav>
  </div>;
}

function NavigationIcon({ kind }: { kind: "home" | "quest" | "merch" | "explore" | "arrow" | "external" | "community" }) {
  const paths = {
    home: <path d="M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h5v5h-5z" />,
    quest: <path d="M4 17V3m0 0h6l1 2h5v8h-6l-1-2H4" />,
    merch: <path d="M4 6h12l1 11H3ZM7 6V5a3 3 0 0 1 6 0v1" />,
    explore: <><circle cx="10" cy="10" r="7.5" /><path d="m13 7-2 4-4 2 2-4Z" /></>,
    arrow: <path d="M4 10h12m-5-5 5 5-5 5" />,
    external: <path d="M5 15 15 5M6 5h9v9" />,
    community: <><circle cx="7" cy="6" r="2.5" /><path d="M2.5 16v-1a4.5 4.5 0 0 1 9 0v1M13 3.5a2.5 2.5 0 0 1 0 5M14 11a4 4 0 0 1 3.5 4v1" /></>,
  };
  return <svg viewBox="0 0 20 20" aria-hidden="true">{paths[kind]}</svg>;
}
