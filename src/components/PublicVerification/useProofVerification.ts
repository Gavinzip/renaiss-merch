import { useEffect, useRef, useState } from 'react';
import type { LoadedProof, VerificationCheck } from '../../../shared/public-proof/types';

export function useProofVerification(proof: LoadedProof | null) {
  const worker = useRef<Worker | null>(null);
  const [checks, setChecks] = useState<VerificationCheck[]>([]);
  const [running, setRunning] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setChecks([]); setRunning(null); setError(null); setReady(false);
    if (!proof) return;
    const current = new Worker(new URL('./verification.worker.ts', import.meta.url), { type: 'module' });
    worker.current = current;
    current.onmessage = (event: MessageEvent<{ type: string; check?: VerificationCheck; error?: string }>) => {
      if (worker.current !== current) return;
      if (event.data.type === 'checked' && event.data.check) setChecks(old => [...old, event.data.check!]);
      if (event.data.type === 'failed') setError(event.data.error ?? '驗證未通過。');
      setRunning(null);
    };
    current.onerror = () => { setRunning(null); setError('瀏覽器驗證器無法執行，未完成驗證。請重新整理後重試。'); };
    current.postMessage({ type: 'init', data: proof });
    setReady(true);
    return () => { current.terminate(); worker.current = null; };
  }, [proof]);
  return { checks, running, error, ready, run(step: number) {
    if (!worker.current || running !== null || step !== checks.length + 1) return;
    setError(null); setRunning(step); worker.current.postMessage({ type: 'step', step });
  } };
}
