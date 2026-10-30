import { useEffect, useRef, useState } from 'react';

export function usePublicValueCopy() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { copied, copyError, async copy(value: string) {
    window.clearTimeout(timer.current); setCopied(false); setCopyError(null);
    try {
      await navigator.clipboard.writeText(value); setCopied(true);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch { setCopyError('Copy failed. Select and copy the full value manually.'); }
  } };
}
