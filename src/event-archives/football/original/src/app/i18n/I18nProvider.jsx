import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOCALE,
  LOCALES,
  createTranslator,
  getHtmlLang,
  getLocaleOption,
} from "./translations";

const STORAGE_KEY = "renaiss-world-cup-locale";

const I18nContext = createContext(null);

function readInitialLocale() {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const requested = new URLSearchParams(window.location.search).get('lang');
  const normalized = requested === 'zh-TW' ? 'zh-Hant' : requested;
  if (LOCALES.some(option => option.id === normalized)) return normalized;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return LOCALES.some((locale) => locale.id === stored) ? stored : DEFAULT_LOCALE;
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(readInitialLocale);

  const value = useMemo(() => {
    const t = createTranslator(locale);
    return {
      locale,
      localeOption: getLocaleOption(locale),
      locales: LOCALES,
      setLocale: (nextLocale) => {
        if (!LOCALES.some((option) => option.id === nextLocale)) return;
        setLocaleState(nextLocale);
      },
      t,
    };
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = getHtmlLang(locale);
    document.title = value.t("meta.title");
    window.localStorage.setItem(STORAGE_KEY, locale);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', locale === 'zh-Hant' ? 'zh-TW' : locale);
    window.history.replaceState(null, '', url);
  }, [locale, value]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}
