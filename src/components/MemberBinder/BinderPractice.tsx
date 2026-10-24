import { useState } from "react";
import samples from "../../../shared/member-binder-samples.json";
import type { MemberBinder } from "../../../shared/member-binder.js";
import type { AppLocale } from "../../i18n/LocaleContext";
import type { RenaissUser } from "../../lib/renaissAuth";
import { binderCopy } from "./binderCopy";
import { binderBadgeUrl } from "./binderAssets";
import { BinderWorkspace } from "./BinderWorkspace";

export const practiceCopy = {
  en: {
    start: "Try with sample badges",
    title: "Practice binder",
    note: "Sample badges · Changes are not saved to your account",
    reset: "Reset samples",
    exit: "Back to my collection",
    name: "Sample collection",
    guide:
      "Tap a badge to take it out and inspect it. Remove it, then choose an empty pocket to put it back.",
  },
  "zh-TW": {
    start: "用示範徽章試玩",
    title: "操作示範",
    note: "示範徽章 · 操作不會存入你的帳號",
    reset: "重設示範",
    exit: "返回我的收藏",
    name: "示範收藏冊",
    guide: "點徽章取出查看；移出後，再點空格把它放回去。",
  },
  ko: {
    start: "샘플 배지로 체험",
    title: "체험 바인더",
    note: "샘플 배지 · 변경 사항은 계정에 저장되지 않습니다",
    reset: "샘플 초기화",
    exit: "내 컬렉션으로",
    name: "샘플 컬렉션",
    guide: "배지를 눌러 꺼내 보고, 제거한 뒤 빈 포켓을 눌러 다시 넣어 보세요.",
  },
};
function initialBinder(): MemberBinder {
  return {
    version: 1,
    pages: [
      {
        id: "sample-first",
        size: 9,
        slots: [...samples.slice(0, 8).map((b) => String(b.id)), null],
      },
      { id: "sample-second", size: 6, slots: Array(6).fill(null) },
      { id: "sample-third", size: 9, slots: Array(9).fill(null) },
    ],
  };
}
const badges = samples.map((b) => ({
  tokenId: String(b.id),
  name: b.name,
  description: b.description,
  howToEarn: b.howToEarn,
  imageUrl: binderBadgeUrl(b.id),
  balance: 1,
}));

export function BinderPractice({
  locale,
  onExit,
}: {
  locale: AppLocale;
  onExit: () => void;
}) {
  const text = practiceCopy[locale];
  const [binder, setBinder] = useState(initialBinder);
  const [generation, setGeneration] = useState(0);
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
      <div className="binder-toolbar binder-practice-toolbar">
        <div>
          <strong>{text.title}</strong>
          <span>{text.note}</span>
        </div>
        <div className="binder-save">
          <button
            type="button"
            onClick={() => {
              setBinder(initialBinder());
              setGeneration((v) => v + 1);
            }}
          >
            {text.reset}
          </button>
          <button type="button" onClick={onExit}>
            {text.exit}
          </button>
        </div>
      </div>
      <p className="binder-practice-guide">{text.guide}</p>
      <BinderWorkspace
        key={generation}
        binder={binder}
        badges={badges}
        user={user}
        copy={binderCopy[locale]}
        onChange={setBinder}
        practice
      />
    </>
  );
}
