import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  POKEMON30_LOCALE_META,
  POKEMON30_LOCALES,
  pokemon30Messages,
} from "./pokemon30Messages";

const LOCALE_STORAGE_KEY = "pokemon30.locale";
const Pokemon30I18nContext = createContext(null);

function isSupportedLocale(locale) {
  return POKEMON30_LOCALES.includes(locale);
}

function localeFromBrowser() {
  const browserLocale = navigator.language?.toLowerCase() ?? "";
  if (browserLocale.startsWith("ko")) return "ko";
  if (browserLocale.startsWith("en")) return "en";
  return "zh-TW";
}

function resolveInitialLocale() {
  const requestedLocale = new URLSearchParams(window.location.search).get("lang");
  if (isSupportedLocale(requestedLocale)) return requestedLocale;

  try {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(storedLocale)) return storedLocale;
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }

  return localeFromBrowser();
}

function readMessage(messages, key) {
  return key.split(".").reduce((value, segment) => value?.[segment], messages);
}

function interpolate(message, values) {
  return message.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ""));
}

export function translatePokemon30(locale, key, values = {}) {
  const message = readMessage(pokemon30Messages[locale], key);
  if (typeof message !== "string") {
    throw new Error(`Missing Pokémon 30 localized message: ${locale}.${key}`);
  }
  return interpolate(message, values);
}

export function Pokemon30I18nProvider({ children }) {
  const [locale, setLocale] = useState(resolveInitialLocale);

  useEffect(() => {
    const localeMeta = POKEMON30_LOCALE_META[locale];
    document.documentElement.lang = localeMeta.htmlLang;
    document.title = translatePokemon30(locale, "pageTitle");

    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Locale selection continues to work for the open page without storage.
    }

    const url = new URL(window.location.href);
    url.searchParams.set("lang", locale);
    window.history.replaceState(null, "", url);
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    locales: POKEMON30_LOCALES,
    localeMeta: POKEMON30_LOCALE_META,
    setLocale,
    t: (key, values) => translatePokemon30(locale, key, values),
  }), [locale]);

  return <Pokemon30I18nContext.Provider value={value}>{children}</Pokemon30I18nContext.Provider>;
}

export function usePokemon30I18n() {
  const context = useContext(Pokemon30I18nContext);
  if (!context) throw new Error("usePokemon30I18n must be used within Pokemon30I18nProvider.");
  return context;
}
