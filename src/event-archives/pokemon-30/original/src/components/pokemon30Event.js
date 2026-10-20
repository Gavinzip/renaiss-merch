export const POKEMON30_EVENT = {
  prizeCount: 10,
  start: "2026-09-16T19:00:00+08:00",
  end: "2026-09-23T19:00:00+08:00",
  timeZone: "UTC+8",
};

const DATE_LOCALES = {
  "zh-TW": "zh-TW",
  en: "en-US",
  ko: "ko-KR",
};

function formatEventLocalTime(value, locale) {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale] ?? DATE_LOCALES["zh-TW"], {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: locale === "en" ? "short" : "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: locale !== "zh-TW",
  }).format(new Date(value));
}

export function formatPokemon30EventWindow(locale, t, event = POKEMON30_EVENT) {
  return t("event.timeRange", {
    start: formatEventLocalTime(event.start, locale),
    end: formatEventLocalTime(event.end, locale),
  });
}

export const POKEMON30_TICKET_RULES = [
  { price: "$28", tickets: 1 },
  { price: "$48", tickets: 2 },
  { price: "$88", tickets: 3 },
  { price: "$248", tickets: 8 },
  { price: "$100", tickets: 5 },
];

export function eventStatus(t, now = Date.now()) {
  const start = Date.parse(POKEMON30_EVENT.start);
  const end = Date.parse(POKEMON30_EVENT.end);
  if (now < start) return { id: "upcoming", label: t("event.upcoming") };
  if (now >= end) return { id: "ended", label: t("event.ended") };
  return { id: "live", label: t("event.live") };
}
