import { useCallback, useEffect, useRef, useState } from 'react';
import type { Winner } from './useSurfDraw';

export const SURF_REVEAL_MIN_MS = 4500;
export const SURF_TICKET_HOLD_MS = 1000;
export type RevealPhase = 'idle' | 'spinning' | 'settling' | 'ticket' | 'identity' | 'revealed';
export function isSurfRevealRunning(phase: RevealPhase) { return phase !== 'idle' && phase !== 'revealed'; }

// Presentation may hold a confirmed result, but never invent or change one.
export function useSurfDrawPresentation(winners: Winner[] | undefined) {
  const [visibleWinners, setVisibleWinners] = useState<Winner[]>([]);
  const [phase, setPhase] = useState<RevealPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [revision, setRevision] = useState(0);
  const [settlingWinner, setSettlingWinner] = useState<Winner>();
  const [batchStart, setBatchStart] = useState(0);
  const [batchSize, setBatchSize] = useState(1);
  const [batchWinners, setBatchWinners] = useState<Winner[]>([]);
  const incoming = useRef<Winner[]>([]);
  const shown = useRef<Winner[]>([]);
  const initialized = useRef(false);
  const run = useRef<{ started: number; slots: number[]; stage: 'spinning' | 'settling' | 'ticket' | 'identity'; stoppedAt?: number } | null>(null);

  const begin = useCallback((slots: number[]) => {
    if (run.current || !slots.length) return;
    run.current = { started: performance.now(), slots, stage: 'spinning' };
    setBatchStart(slots[0]); setBatchSize(slots.length); setBatchWinners([]);
    setSettlingWinner(undefined);
    setElapsed(0); setRevision(value => value + 1); setPhase('spinning');
  }, []);

  useEffect(() => {
    if (!winners) return;
    incoming.current = winners;
    if (!initialized.current) {
      initialized.current = true;
      shown.current = winners;
      setVisibleWinners(winners);
      if (winners.length) setPhase('revealed');
    } else if (!run.current) {
      const known = new Set(shown.current.map(winner => winner.slot));
      const unseen = winners.filter(winner => !known.has(winner.slot));
      if (unseen.length) {
        // An observer reconnecting after a batch sees each published slot.
        const slots = [unseen[0].slot];
        for (const winner of unseen.slice(1)) {
          if (winner.slot !== slots.at(-1)! + 1 || (winner.slot < 7) !== (slots[0] < 7)) break;
          slots.push(winner.slot);
        }
        begin(slots);
      }
    }
  }, [winners, visibleWinners.length, begin]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const current = run.current;
      if (!current) return;
      if (current.stage === 'ticket' && performance.now() - current.stoppedAt! >= SURF_TICKET_HOLD_MS) {
        current.stage = 'identity';
        setPhase('identity');
      }
      if (current.stage !== 'spinning') return;
      const duration = performance.now() - current.started;
      setElapsed(duration);
      // A late receipt keeps the reels spinning. An early receipt stays hidden.
      const results = current.slots.map(slot => incoming.current.find(winner => winner.slot === slot));
      if (duration < 800 || results.some(winner => !winner)) return;
      current.stage = 'settling';
      setSettlingWinner(results[0]);
      setBatchWinners(results as Winner[]);
      setPhase('settling');
    }, 80);
    return () => { window.clearInterval(tick); run.current = null; };
  }, []);

  const complete = useCallback(() => {
    const current = run.current;
    if (current?.stage !== 'settling') return;
    current.stage = 'ticket';
    current.stoppedAt = performance.now();
    setPhase('ticket');
  }, []);

  const revealIdentity = useCallback(() => {
    const current = run.current;
    if (current?.stage !== 'identity') return;
    const slots = new Set([...shown.current.map(winner => winner.slot), ...current.slots]);
    shown.current = incoming.current.filter(winner => slots.has(winner.slot));
    setVisibleWinners(shown.current);
    setSettlingWinner(undefined);
    setPhase('revealed');
    run.current = null;
  }, []);

  const cancel = useCallback(() => {
    // A failed later transaction cannot erase already confirmed batch results.
    // Expose the authoritative partial group and leave the actual error visible.
    const current = run.current;
    const confirmed = current ? current.slots.flatMap(slot => incoming.current.filter(winner => winner.slot === slot)) : [];
    if (confirmed.length) {
      setBatchWinners(confirmed); setBatchSize(confirmed.length);
      const slots = new Set([...shown.current.map(winner => winner.slot), ...confirmed.map(winner => winner.slot)]);
      shown.current = incoming.current.filter(winner => slots.has(winner.slot));
      setVisibleWinners(shown.current);
    }
    run.current = null;
    setSettlingWinner(undefined);
    setPhase(shown.current.length ? 'revealed' : 'idle');
  }, []);

  return { visibleWinners, settlingWinner, batchStart, batchSize, batchWinners, phase, elapsed, revision, begin, complete, revealIdentity, cancel };
}
