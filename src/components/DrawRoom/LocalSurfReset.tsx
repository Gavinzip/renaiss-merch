import { useEffect } from 'react';
import { useLocalSurfReset } from './useLocalSurfReset';
import { useLocalSurfReplacement } from './useLocalSurfReplacement';
import './LocalSurfReset.css';

export const canShowLocalSurfReset = () => import.meta.env.DEV &&
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

export function LocalSurfReset({ authenticated, drawBusy, onComplete, onBusyChange }: {
  authenticated: boolean; drawBusy: boolean; onComplete: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const reset = useLocalSurfReset(authenticated, onComplete);
  const replacement = useLocalSurfReplacement(authenticated, onComplete);
  useEffect(() => { onBusyChange(reset.busy || replacement.busy); return () => onBusyChange(false); }, [reset.busy, replacement.busy, onBusyChange]);
  return <section className="draw-local-reset" aria-label="本地鏈上重置">
    {!replacement.canReplace ? <div><button type="button" disabled={drawBusy || reset.busy || !reset.canReset} onClick={() => void reset.reset()}>
      <span aria-hidden="true">↺</span>{reset.busy ? '等待鏈上重置確認…' : '鏈上重置'}
    </button><small>BSC 正式開獎 · 僅本地</small></div> : null}
    {replacement.canReplace ? <div><button type="button" disabled={drawBusy || reset.busy || replacement.busy}
      onClick={() => void replacement.replace()}>{replacement.busy ? '正在建立新輪…' : '作廢舊輪並建立新輪'}</button></div> : null}
    {reset.message && !replacement.canReplace ? <p role="status">{reset.message}</p> : null}
    {replacement.error ? <p role="alert">{replacement.error}</p> : null}
    {reset.txHash ? <a href={`https://bscscan.com/tx/${reset.txHash}`} target="_blank" rel="noopener noreferrer">查看重置交易 ↗</a> : null}
  </section>;
}
