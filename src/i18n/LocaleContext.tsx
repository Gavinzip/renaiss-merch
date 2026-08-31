import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { MerchProductId } from '../lib/merchProducts';

export type AppLocale = 'en' | 'zh-TW';

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
    return storedLocale === 'zh-TW' ? 'zh-TW' : defaultLocale;
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
  }
};
