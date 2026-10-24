import { useState, type ReactNode } from "react";
import type { AppLocale } from "../../i18n/LocaleContext";
import type { RenaissUser } from "../../lib/renaissAuth";
import { createPracticeBinder, practiceBinderCopy, practiceLibrary, type PracticeKind } from "./binderPracticeData";
import { BinderWorkspace } from "./BinderWorkspace";

export const practiceCopy = {
  en: {
    start: "Try with sample cards",
    cards: "Trading cards", badges: "SBT badges",
    title: "Practice binder",
    note: "Practice collection · Changes are not saved to your account",
    reset: "Reset samples",
    exit: "Back to my collection",
    name: "Sample collection",
    guide:
      "Tap a card to take it out and inspect it. Remove it, then choose an empty pocket to put it back.",
  },
  "zh-TW": {
    start: "用模擬卡片試玩",
    cards: "一般卡片", badges: "SBT 徽章",
    title: "操作示範",
    note: "試玩收藏 · 操作不會存入你的帳號",
    reset: "重設示範",
    exit: "返回我的收藏",
    name: "示範收藏冊",
    guide: "點卡片取出查看；移出後，再點空格把它放回去。切換種類會重設試玩內容。",
  },
  ko: {
    start: "모의 카드로 체험",
    cards: "트레이딩 카드", badges: "SBT 배지",
    title: "체험 바인더",
    note: "체험 컬렉션 · 변경 사항은 계정에 저장되지 않습니다",
    reset: "샘플 초기화",
    exit: "내 컬렉션으로",
    name: "샘플 컬렉션",
    guide: "카드를 눌러 꺼내 보고, 제거한 뒤 빈 포켓에 다시 넣어 보세요. 종류를 바꾸면 체험이 초기화됩니다.",
  },
};

export function BinderPractice({
  locale,
  renderTools,
  onExit,
}: {
  locale: AppLocale;
  renderTools: (contents: ReactNode) => ReactNode;
  onExit: () => void;
}) {
  const text = practiceCopy[locale];
  const [kind, setKind] = useState<PracticeKind>(() => new URLSearchParams(location.search).get("binderSamples") === "badges" ? "badges" : "cards");
  const [binder, setBinder] = useState(() => createPracticeBinder(kind));
  const [generation, setGeneration] = useState(0);
  function reset(next: PracticeKind) {
    setKind(next);
    setBinder(createPracticeBinder(next));
    setGeneration((v) => v + 1);
    const url = new URL(location.href);
    url.searchParams.set("binderSamples", next);
    history.replaceState(history.state, "", url);
  }
  // This is a named sample collection, never an authenticated identity/session.
  const user: RenaissUser = {
    sub: "sample-collection",
    name: text.name,
    picture: null,
    email: null,
    emailVerified: false,
    safeWalletAddress: null,
    legacyWalletAddress: null,
    chainId: null,
    twitterUsername: null,
    canManageFulfillment: false,
  };
  return (
    <>
      {renderTools(
        <>
          <div className="binder-toolbar binder-practice-toolbar">
            <div>
              <strong>{text.title}</strong>
              <span>{text.note}</span>
            </div>
            <div className="binder-save">
              <button
                type="button"
                onClick={() => {
                  reset(kind);
                }}
              >
                {text.reset}
              </button>
              <button type="button" onClick={onExit}>
                {text.exit}
              </button>
            </div>
          </div>
          <div className="binder-practice-kinds" role="group" aria-label={text.title}>
            {(["cards", "badges"] as const).map((value) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => reset(value)}>{text[value]}</button>)}
          </div>
          <p className="binder-practice-guide">{text.guide}</p>
        </>,
      )}
      <BinderWorkspace
        key={generation}
        binder={binder}
        badges={practiceLibrary(kind, locale)}
        user={user}
        copy={practiceBinderCopy(locale, kind)}
        onChange={setBinder}
        practice
      />
    </>
  );
}
