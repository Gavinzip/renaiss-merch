import { useState } from "react";
import type { AppLocale } from "../../i18n/LocaleContext";

// A failed original is shown as a failure, never replaced with stock imagery.
export function HubFeedImage({ url, locale, eager = false, onSettled }: { url: string; locale: AppLocale; eager?: boolean; onSettled?: () => void }) {
  const [failed, setFailed] = useState(false);
  return <div className="hub-feed__image">
    {failed ? <span>{inlineCopy[locale].imageUnavailableOpenTheOriginalPost}</span>
      : <img src={url} alt="" loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer"
          onLoad={event => { if (onSettled) void event.currentTarget.decode().then(onSettled, () => { setFailed(true); onSettled(); }); }}
          onError={() => { setFailed(true); onSettled?.(); }} />}
  </div>;
}

const inlineCopy = {
  "en": {
    imageUnavailableOpenTheOriginalPost: "Image unavailable · open the original post"
  },
  "zh-TW": {
    imageUnavailableOpenTheOriginalPost: "圖片無法載入 · 可開啟原文查看"
  },
  "ko": {
    imageUnavailableOpenTheOriginalPost: "이미지를 불러올 수 없습니다 · 원본 게시물에서 확인해 주세요"
  }
} as const;
