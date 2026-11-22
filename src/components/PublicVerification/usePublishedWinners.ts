import { useEffect, useState } from 'react';
import type { LoadedProof } from '../../../shared/public-proof/types';

type PublishedWinner = { matchId: string; ticketNumber: number; xUsername: string };

export function usePublishedWinners({ bundle, bundleHash, authority }: LoadedProof) {
  const [winners, setWinners] = useState<PublishedWinner[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (authority.context === 'rehearsal') return;
    const controller = new AbortController();
    const query = new URLSearchParams({ stage: bundle.manifest.stage, tx: bundle.chain.requestTx, bundleHash });
    void (async () => {
      try {
        const response = await fetch('/api/public-proofs/worlds-2026/winners?' + query, {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        if (!response.ok) throw new Error('Public winner list unavailable.');
        const data = await response.json() as { winners: PublishedWinner[] };
        if (!Array.isArray(data.winners) || data.winners.some(row => !row || typeof row.matchId !== 'string' ||
          !Number.isSafeInteger(row.ticketNumber) || typeof row.xUsername !== 'string' || !/^[a-z0-9_]{1,15}$/i.test(row.xUsername))) {
          throw new Error('Invalid public winner list.');
        }
        if (!controller.signal.aborted) setWinners(data.winners);
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      }
    })();
    return () => controller.abort();
  }, [authority.context, bundle.manifest.stage, bundle.chain.requestTx, bundleHash]);
  return { winners, unavailable };
}
