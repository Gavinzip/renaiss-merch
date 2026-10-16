import { useEffect } from 'react';
import { useLocalSurfReset } from './useLocalSurfReset';
import './LocalSurfReset.css';

export const canShowLocalSurfReset = () => import.meta.env.DEV &&
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

export function LocalSurfReset({ authenticated, drawBusy, onComplete, onBusyChange }: {
  authenticated: boolean; drawBusy: boolean; onComplete: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const reset = useLocalSurfReset(authenticated, onComplete);
  useEffect(() => { onBusyChange(reset.busy); return () => onBusyChange(false); }, [reset.busy, onBusyChange]);
  return <section className="draw-local-reset" aria-label="本地鏈上重置">
    <div><button type="button" disabled={drawBusy || reset.busy || !reset.canReset} onClick={() => void reset.reset()}>
      <span aria-hidden="true">↺</span>{reset.busy ? '等待鏈上重置確認…' : '鏈上重置'}
    </button><small>BSC 正式開獎 · 僅本地</small></div>
    {reset.message ? <p role="status">{reset.message}</p> : null}
    {reset.txHash ? <a href={`https://bscscan.com/tx/${reset.txHash}`} target="_blank" rel="noopener noreferrer">查看重置交易 ↗</a> : null}
  </section>;
}
