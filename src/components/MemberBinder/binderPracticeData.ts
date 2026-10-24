import samples from "../../../shared/member-binder-samples.json";
import cardSamples from "../../../shared/member-binder-card-samples.json";
import type { MemberBinder } from "../../../shared/member-binder.js";
import type { AppLocale } from "../../i18n/LocaleContext";
import { binderBadgeUrl } from "./binderAssets";
import { binderCopy, type BinderCopy } from "./binderCopy";
import type { BinderCollectible, BinderSampleCard } from "./binderCollectible";

export type PracticeKind = "cards" | "badges";
const cards: BinderSampleCard[] = Array.from({ length: 18 }, (_, index) => {
  const image = ([1, 2, 3] as const)[index % 3];
  const title = cardSamples[image - 1].displayName;
  return {
    tokenId: String(9001 + index), name: `${title} · ${String(index + 1).padStart(3, "0")}`,
    description: "Public reference card. Practice only; not in your collection.",
    howToEarn: "",
    balance: 1, sampleCard: { image, edition: index + 1 },
  };
});
const badges: BinderCollectible[] = samples.map((b) => ({
  tokenId: String(b.id), name: b.name, description: b.description,
  howToEarn: b.howToEarn, imageUrl: binderBadgeUrl(b.id), balance: 1,
}));
export function practiceLibrary(kind: PracticeKind, locale: AppLocale = "en"): BinderCollectible[] {
  const description = { en: "Public reference card. Practice only; not in your collection.", "zh-TW": "原站公開卡圖，僅供試玩，不代表你持有此卡。", ko: "공개 참고 카드입니다. 체험 전용이며 보유 카드가 아닙니다." }[locale];
  return kind === "cards" ? cards.map(card => ({ ...card, description })) : badges;
}
export function createPracticeBinder(kind: PracticeKind): MemberBinder {
  const tokens = practiceLibrary(kind).map((item) => item.tokenId);
  const page = (id: string, size: 6 | 9, from: number, count: number) => ({
    id, size, slots: Array.from({ length: size }, (_, i) => i < count ? tokens[from + i] : null),
  });
  return { version: 1, pages: kind === "cards"
    ? [page("sample-first", 9, 0, 8), page("sample-second", 6, 8, 5), page("sample-third", 9, 13, 4)]
    : [page("sample-first", 9, 0, 8), page("sample-second", 6, 8, 0), page("sample-third", 9, 8, 0)] };
}
const cardCopy = {
  en: { practice: "Simulated cards", choose: "Choose a card", search: "Search cards", replace: "Replace card", hideAdded: "Hide added cards", detail: "Card details", tokenId: "Card number", howToEarn: "Practice instructions", empty: "No matching cards", itemUnit: "cards" },
  "zh-TW": { practice: "模擬卡片", choose: "選擇卡片", search: "搜尋卡片", replace: "更換卡片", hideAdded: "隱藏已放入的卡片", detail: "卡片詳情", tokenId: "卡片編號", howToEarn: "試玩說明", empty: "沒有符合的卡片", itemUnit: "張卡片" },
  ko: { practice: "모의 카드", choose: "카드 선택", search: "카드 검색", replace: "카드 교체", hideAdded: "추가된 카드 숨기기", detail: "카드 상세", tokenId: "카드 번호", howToEarn: "체험 안내", empty: "일치하는 카드 없음", itemUnit: "카드" },
};
export function practiceBinderCopy(locale: AppLocale, kind: PracticeKind): BinderCopy {
  return { ...binderCopy[locale], ...(kind === "cards" ? cardCopy[locale] : {}) };
}
