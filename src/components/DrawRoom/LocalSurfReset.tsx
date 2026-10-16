import { useEffect } from 'react';
import { useLocalSurfReset } from './useLocalSurfReset';
import type { useLocalSurfOperator } from './useLocalSurfOperator';
import './LocalSurfReset.css';

export const canShowLocalSurfReset = () => import.meta.env.DEV &&
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

export function LocalSurfReset({ operator, drawBusy, onComplete, onBusyChange }: {
  operator: ReturnType<typeof useLocalSurfOperator>; drawBusy: boolean; onComplete: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const reset = useLocalSurfReset(operator.connected, onComplete);
  useEffect(() => { onBusyChange(reset.busy && operator.connected); return () => onBusyChange(false); }, [reset.busy, operator.connected, onBusyChange]);
  return <section className="draw-local-reset" aria-label="本地鏈上重置">
    <div>{!operator.connected ? <button type="button" disabled={drawBusy || operator.busy} onClick={() => void operator.connect()}>
      {operator.pending ? '等待管理員確認' : '連接正式開獎'} ↗
    </button> : <button type="button" disabled={drawBusy || reset.busy || !reset.canReset} onClick={() => void reset.reset()}>
      <span aria-hidden="true">↺</span>{reset.busy ? '等待鏈上重置確認…' : '鏈上重置'}
    </button>}<small>BSC 正式開獎 · 僅本地</small></div>
    {operator.message || operator.connected && reset.message ? <p role="status">{operator.connected ? reset.message || operator.message : operator.message}</p> : null}
    {reset.txHash ? <a href={`https://bscscan.com/tx/${reset.txHash}`} target="_blank" rel="noopener noreferrer">查看重置交易 ↗</a> : null}
    {operator.connected ? <button className="draw-local-reset__refresh" type="button" disabled={drawBusy || reset.busy || operator.busy}
      onClick={() => void operator.disconnect()}>斷開連接</button> : null}
  </section>;
}
