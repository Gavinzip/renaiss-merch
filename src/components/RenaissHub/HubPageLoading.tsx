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

  return <div ref={rootRef} className={`hub-page-loading ${className}`.trim()} data-revealed={ready} role={error ? 'alert' : 'status'} aria-label={!error ? inlineCopy[locale].loadingRenaissCommunity : undefined} aria-hidden={ready}>
    <div className="hub-page-loading__brand" aria-hidden="true"><HubWordmark /></div>
    {error ? <>
      <p className="hub-page-loading__error">{inlineCopy[locale].thisPageCouldNotLoad}</p>
      {onRetry ? <button type="button" onClick={onRetry}>{inlineCopy[locale].reload}</button> : null}
    </> : <>
      <span className="hub-page-loading__label t-shimmer" data-text="LOADING" aria-hidden="true">LOADING</span>
      <span className="hub-page-loading__trace" aria-hidden="true"><span /></span>
      <p className="hub-page-loading__support">{inlineCopy[locale].preparingYourRenaissCommunity}</p>
    </>}
  </div>;
}

const inlineCopy = {
  "en": {
    loadingRenaissCommunity: "Loading Renaiss Community",
    thisPageCouldNotLoad: "This page could not load",
    reload: "Reload",
    preparingYourRenaissCommunity: "Preparing your Renaiss Community"
  },
  "zh-TW": {
    loadingRenaissCommunity: "正在載入 Renaiss Community",
    thisPageCouldNotLoad: "頁面暫時無法載入",
    reload: "重新載入",
    preparingYourRenaissCommunity: "正在為你準備 Renaiss Community"
  },
  "ko": {
    loadingRenaissCommunity: "Renaiss Community 로딩 중",
    thisPageCouldNotLoad: "페이지를 불러올 수 없습니다",
    reload: "새로고침",
    preparingYourRenaissCommunity: "Renaiss Community를 준비하고 있습니다"
  }
} as const;
