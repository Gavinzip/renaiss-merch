import { createContext, createElement, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { formatMessage, intlLocale, translate } from './translation';
export const LOCALE_STORAGE_KEY = 'renaiss-lol.locale';
function storedLocale() {
    const requested = new URLSearchParams(location.search).get('lang');
    if (requested === 'zh-TW' || requested === 'zh-Hant')
        return 'zh-Hant';
    if (requested === 'en' || requested === 'ko')
        return requested;
    try {
        const value = localStorage.getItem(LOCALE_STORAGE_KEY);
        if (value === 'en' || value === 'ko' || value === 'zh-Hant')
            return value;
    }
    catch { /* Storage can be disabled; switching still works for the current visit. */ }
    return 'zh-Hant';
}
const I18nContext = createContext({ locale: 'zh-Hant', setLocale: (_locale) => { }, text: (source) => source, t: (source, _values) => source });
export function I18nProvider({ children }) {
    const [locale, setLocale] = useState(storedLocale);
    useLayoutEffect(() => {
        document.documentElement.lang = locale;
        const url = new URL(location.href);
        url.searchParams.set('lang', locale === 'zh-Hant' ? 'zh-TW' : locale);
        history.replaceState(history.state, '', url);
        try {
            localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        }
        catch { /* No persistence when browser storage is disabled. */ }
    }, [locale]);
    const value = useMemo(() => ({ locale, setLocale, text: (source) => translate(source, locale), t: (source, values) => formatMessage(source, locale, values) }), [locale]);
    return createElement(I18nContext.Provider, { value }, children);
}
export const useI18n = () => useContext(I18nContext);
export function useLocaleFormat() {
    const { locale } = useI18n();
    return useMemo(() => ({
        number: (value) => new Intl.NumberFormat(intlLocale(locale)).format(value),
        date: (value, options = {}) => new Intl.DateTimeFormat(intlLocale(locale), { timeZone: 'Asia/Taipei', ...options }).format(new Date(value)),
    }), [locale]);
}
