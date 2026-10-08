import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { MerchProductId } from '../lib/merchProducts';

export const APP_LOCALES = ['en', 'zh-TW', 'ko'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const appLanguages: { value: AppLocale; label: string; shortLabel: string; menuLabel: string }[] = [
  { value: 'en', label: 'English', shortLabel: 'EN', menuLabel: 'Language' },
  { value: 'zh-TW', label: '繁體中文', shortLabel: '中文', menuLabel: '語言' },
  { value: 'ko', label: '한국어', shortLabel: '한국어', menuLabel: '언어' },
];

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
};

const LOCALE_STORAGE_KEY = 'renaiss-merch-locale';
const defaultLocale: AppLocale = 'en';
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(readStoredLocale);
  const value = useMemo(() => ({ locale, setLocale }), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    writeStoredLocale(locale);
  }, [locale]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error('useLocale must be used inside LocaleProvider.');
  }

  return context;
}

export function readLocalizedProductName(
  productId: MerchProductId,
  locale: AppLocale
) {
  return productNames[locale][productId];
}

export function formatLocalizedDate(value: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function readStoredLocale(): AppLocale {
  try {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return APP_LOCALES.includes(storedLocale as AppLocale) ? storedLocale as AppLocale : defaultLocale;
  } catch {
    return defaultLocale;
  }
}

function writeStoredLocale(locale: AppLocale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The in-memory locale remains usable when storage is unavailable.
  }
}

const productNames: Record<
  AppLocale,
  Record<MerchProductId, string>
> = {
  en: {
    bracelet: 'Renaiss Bracelet',
    shirt: 'Renaiss Tee',
    ticket: 'Flagship Taiwan VIP Ticket'
  },
  'zh-TW': {
    bracelet: 'Renaiss 手鍊',
    shirt: 'Renaiss 限量 T 恤',
    ticket: '旗艦卡展台灣站 VIP 票券'
  },
  ko: {
    bracelet: 'Renaiss 팔찌',
    shirt: 'Renaiss 한정 티셔츠',
    ticket: 'Flagship 대만 VIP 티켓'
  }
};
