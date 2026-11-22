import { useEffect, useRef, useState } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { fairCopy } from './fairCopy';

export function usePublicValueCopy(locale: AppLocale) {
  const t = fairCopy(locale);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { copied, copyError, async copy(value: string) {
    window.clearTimeout(timer.current); setCopied(false); setCopyError(null);
    try {
      await navigator.clipboard.writeText(value); setCopied(true);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch { setCopyError(t('Copy failed. Select and copy the full value manually.')); }
  } };
}
