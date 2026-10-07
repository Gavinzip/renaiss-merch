import { useEffect, useRef, useState } from 'react';
import type { RenaissHubCopy } from './RenaissHubCopy';

// Copy/Copied follows the actual Clipboard result, with no legacy copy fallback.
export function HubWalletCopy({ address, copy }: { address: string; copy: RenaissHubCopy['member'] }) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const operation = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => { operation.current++; window.clearTimeout(timer.current); }, []);

  async function copyAddress() {
    const current = ++operation.current;
    window.clearTimeout(timer.current);
    setStatus('copying');
    try {
      await navigator.clipboard.writeText(address);
      if (current !== operation.current) return;
      setStatus('copied');
      timer.current = window.setTimeout(() => setStatus('idle'), 2200);
    } catch {
      if (current === operation.current) setStatus('error');
    }
  }

  return <>
    <button className="hub-member__wallet-copy" type="button" onClick={() => void copyAddress()}
      disabled={status === 'copying'} data-copied={status === 'copied'}
      aria-label={status === 'copied' ? copy.copiedWallet : copy.copyWallet} title={address}>
      <span>{address.slice(0, 6)}…{address.slice(-4)}</span>
      <span className="hub-member__copy-icon" aria-hidden="true">
        <svg className="hub-member__copy-sheet" viewBox="0 0 20 20"><rect x="7" y="7" width="9" height="9" rx="2" /><path d="M12 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h2" /></svg>
        <svg className="hub-member__copy-check" viewBox="0 0 20 20"><path d="m4 10 4 4 8-8" /></svg>
      </span>
    </button>
    <span className={status === 'error' ? 'hub-member__copy-error' : 'hub-visually-hidden'} role="status">
      {status === 'copied' ? copy.copiedWallet : status === 'error' ? copy.copyError : ''}
    </span>
  </>;
}
