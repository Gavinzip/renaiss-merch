import { useEffect } from 'react';
import { useLocalSurfReset } from './useLocalSurfReset';
import { useLocalSurfReplacement } from './useLocalSurfReplacement';
import './LocalSurfReset.css';

export const canShowLocalSurfReset = () => import.meta.env.DEV &&
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

export function LocalSurfReset({ authenticated, drawBusy, onComplete, onBusyChange, root, online }: {
  authenticated: boolean; drawBusy: boolean; onComplete: () => void; onBusyChange: (busy: boolean) => void;
  root: string; online: boolean;
}) {
  const reset = useLocalSurfReset(authenticated, onComplete, root);
  const replacement = useLocalSurfReplacement(authenticated, onComplete, root);
  useEffect(() => { onBusyChange(reset.busy || replacement.busy); return () => onBusyChange(false); }, [reset.busy, replacement.busy, onBusyChange]);
  return <section className="draw-local-reset" aria-label={online ? '正式開獎重抽' : '本地鏈上重置'}>
    {!replacement.canReplace && reset.reasonCode !== 'chainlink_round_cannot_reset' && (!online || reset.canReset || reset.busy) ? <div><button type="button" disabled={drawBusy || reset.busy || !reset.canReset} onClick={() => void reset.reset()}>
      <span aria-hidden="true">↺</span>{reset.busy ? '等待鏈上重置確認…' : '鏈上重置'}
    </button><small>BSC 正式開獎{online ? '' : ' · 僅本地'}</small></div> : null}
    {replacement.canReplace ? <div><button type="button" disabled={drawBusy || reset.busy || replacement.busy}
      onClick={() => void replacement.replace()}>{replacement.busy ? '正在建立新輪…' : replacement.reason === 'completed_round_redraw'
        ? '重新抽出 27 個獎位' : replacement.provider === 'chainlink-v2.5' ? '切換 Chainlink 並重置' : '作廢舊輪並建立新輪'}</button></div> : null}
    {online && reset.reasonCode === 'chainlink_round_cannot_reset' && !replacement.canReplace
      ? <div><button type="button" disabled>重新抽出 27 個獎位</button></div> : null}
    {reset.message && !replacement.canReplace && !online ? <p role="status">{reset.message}</p> : null}
    {replacement.error ? <p role="alert">{replacement.error}</p> : null}
    {reset.txHash ? <a href={`https://bscscan.com/tx/${reset.txHash}`} target="_blank" rel="noopener noreferrer">查看重置交易 ↗</a> : null}
  </section>;
}
