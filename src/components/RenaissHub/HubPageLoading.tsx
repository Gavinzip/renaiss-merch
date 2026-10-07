import { useEffect, useRef, useState } from 'react';
import './HubPageLoading.css';
import type { AppLocale } from '../../i18n/LocaleContext';
import { HubWordmark } from './HubWordmark';

export function HubPageLoading({ error = false, onRetry, locale = 'en', ready = false, className = '' }: {
  error?: boolean;
  onRetry?: () => void;
  locale?: AppLocale;
  ready?: boolean;
  className?: string;
}) {
  const zh = locale === 'zh-TW';
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!ready);

  useEffect(() => {
    if (!ready) {
      setVisible(true);
      return;
    }

    const root = rootRef.current;
    if (!root) return;
    const duration = getComputedStyle(root).getPropertyValue('--loading-reveal-dur').trim();
    const value = Number.parseFloat(duration);
    if (!Number.isFinite(value)) throw new Error('Missing loading reveal duration');
    const milliseconds = value * (duration.endsWith('ms') ? 1 : 1000);
    const timer = window.setTimeout(() => setVisible(false), milliseconds);
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (!visible) return null;

  return <div ref={rootRef} className={`hub-page-loading ${className}`.trim()} data-revealed={ready} role={error ? 'alert' : 'status'} aria-label={!error ? zh ? '正在載入 Renaiss Community' : 'Loading Renaiss Community' : undefined} aria-hidden={ready}>
    <div className="hub-page-loading__brand" aria-hidden="true"><HubWordmark /></div>
    {error ? <>
      <p className="hub-page-loading__error">{zh ? '頁面暫時無法載入' : 'This page could not load'}</p>
      {onRetry ? <button type="button" onClick={onRetry}>{zh ? '重新載入' : 'Reload'}</button> : null}
    </> : <>
      <span className="hub-page-loading__label t-shimmer" data-text="LOADING" aria-hidden="true">LOADING</span>
      <span className="hub-page-loading__trace" aria-hidden="true"><span /></span>
      <p className="hub-page-loading__support">{zh ? '正在為你準備 Renaiss Community' : 'Preparing your Renaiss Community'}</p>
    </>}
  </div>;
}
