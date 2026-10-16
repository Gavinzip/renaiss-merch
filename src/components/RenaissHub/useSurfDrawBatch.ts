import { useCallback, useEffect, useRef, useState } from 'react';
import type { Prize, Winner } from './useSurfDraw';
import { remainingSurfPrizeSlots } from '../../../shared/surf-draw-selection.js';
import { isSurfRevealRunning, type RevealPhase } from './useSurfDrawPresentation';

// A selected prize group is revealed by one atomic contract call.
export function useSurfDrawBatch({ prizes, kind, visibleWinners, confirmedWinners, phase, canReveal, failed, execute, begin, cancel }: {
  prizes: Prize[]; kind: Prize['kind']; visibleWinners: Winner[]; confirmedWinners: Winner[];
  phase: RevealPhase; canReveal: boolean; failed?: boolean;
  execute: (slots: number[]) => Promise<boolean>; begin: (slots: number[]) => void; cancel: () => void;
}) {
  const [batch, setBatch] = useState<number[] | null>(null);
  const intent = useRef<number[] | null>(null);
  const generation = useRef(0);
  const latest = useRef({ execute, begin, cancel });
  latest.current = { execute, begin, cancel };
  const available = remainingSurfPrizeSlots(prizes, visibleWinners, kind);
  const limit = available.length;
  const confirmed = new Set(confirmedWinners.map(winner => winner.slot));

  const start = useCallback(() => {
    if (intent.current || isSurfRevealRunning(phase) || !limit || !canReveal || confirmedWinners.length !== visibleWinners.length) return;
    const slots = [...available];
    intent.current = slots;
    const run = ++generation.current;
    setBatch(slots);
    latest.current.begin(slots);
    void latest.current.execute(slots).then(ok => {
      if (run !== generation.current || ok) return;
      intent.current = null; setBatch(null); latest.current.cancel();
    });
  }, [phase, limit, canReveal, confirmedWinners.length, visibleWinners.length, available.join(',')]);

  useEffect(() => {
    if (!batch) return;
    if (failed) {
      generation.current++; intent.current = null; setBatch(null); latest.current.cancel();
    } else if (batch.every(slot => visibleWinners.some(winner => winner.slot === slot))) {
      intent.current = null; setBatch(null);
    }
  }, [batch, failed, visibleWinners]);
  useEffect(() => () => { generation.current++; }, []);

  return { amount: batch?.length ?? limit, limit,
    slots: batch ?? available, active: Boolean(batch), start,
    progress: batch ? { current: batch.filter(slot => confirmed.has(slot)).length, total: batch.length } : null };
}
