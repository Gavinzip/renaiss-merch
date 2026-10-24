import { useEffect, useId, useState } from "react";
import type { AppLocale } from "../../i18n/LocaleContext";
import "./BinderViewControls.css";

const viewCopy = {
  en: {
    tools: "Tools", close: "Close tools", practice: "Sample badges", dirty: "Unsaved",
    enter: "Full screen", exit: "Exit full screen", safari: "Hide Safari toolbar",
    hint: "In Safari, open the page menu beside the address and choose Hide Toolbar. The book resizes to the extra space automatically. Tap the address to restore the toolbar.",
    error: "The browser could not enter full screen. Please try again.",
  },
  "zh-TW": {
    tools: "工具", close: "收起工具", practice: "操作示範", dirty: "未儲存",
    enter: "全螢幕", exit: "離開全螢幕", safari: "隱藏 Safari 工具列",
    hint: "在 Safari 網址旁的「頁面選單」選擇「隱藏工具列」，卡冊會自動延伸到增加的空間。點上方網址可恢復工具列。",
    error: "瀏覽器無法進入全螢幕，請再試一次。",
  },
  ko: {
    tools: "도구", close: "도구 닫기", practice: "샘플 배지", dirty: "저장 안 됨",
    enter: "전체 화면", exit: "전체 화면 종료", safari: "Safari 도구 막대 숨기기",
    hint: "Safari 주소 옆 페이지 메뉴에서 도구 막대 가리기를 선택하세요. 바인더가 늘어난 공간에 맞춰집니다. 주소를 누르면 도구 막대가 다시 표시됩니다.",
    error: "전체 화면을 열 수 없습니다. 다시 시도해 주세요.",
  },
};

// Browser chrome belongs to Safari. Offer its native instruction when element
// fullscreen is unavailable, rather than pretending CSS can hide that toolbar.
export function BinderViewControls({ locale, toolsOpen, onToggleTools, practice, dirty }: {
  locale: AppLocale;
  toolsOpen: boolean;
  onToggleTools: () => void;
  practice: boolean;
  dirty: boolean;
}) {
  const text = viewCopy[locale];
  const hintId = useId();
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [error, setError] = useState(false);
  const supported = Boolean(document.fullscreenEnabled);
  useEffect(() => {
    const changed = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  async function toggleFullscreen() {
    setError(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError(true);
    }
  }
  return <>
    {practice && !toolsOpen ? <span className="binder-view-practice">{text.practice}</span> : null}
    <button type="button" className="binder-view-tools" aria-expanded={toolsOpen} onClick={onToggleTools}>
      <span aria-hidden="true">{toolsOpen ? "×" : "☰"}</span>
      <span>{toolsOpen ? text.close : practice ? text.practice : text.tools}</span>
      {dirty ? <span className="binder-view-dirty" role="status">{text.dirty}</span> : null}
    </button>
    <button type="button" className="binder-view-fullscreen" aria-label={supported ? fullscreen ? text.exit : text.enter : text.safari}
      title={supported ? fullscreen ? text.exit : text.enter : text.safari}
      onClick={supported ? () => void toggleFullscreen() : undefined}
      popoverTarget={supported ? undefined : hintId}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        {fullscreen ? <path d="M9 3v6H3m12-6v6h6M9 21v-6H3m12 6v-6h6" /> : <path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6" />}
      </svg>
    </button>
    <aside id={hintId} popover="auto" className="binder-browser-hint"><p>{text.hint}</p></aside>
    {error ? <p className="binder-fullscreen-error" role="alert">{text.error}</p> : null}
  </>;
}
