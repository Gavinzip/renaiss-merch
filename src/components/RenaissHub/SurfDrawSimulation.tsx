import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { SurfDrawBoard } from './SurfDrawBoard';
import { publicPrizes, type Prize, type Winner } from './useSurfDraw';
import { useSurfDrawPresentation } from './useSurfDrawPresentation';
import { useSurfDrawBatch } from './useSurfDrawBatch';

// A separate, local fixture. It never reads a participant ledger or calls an API.
// The first two tickets belong to the same demo person, demonstrating the rule.
export function simulatedSurfWinner(slot: number): Winner {
  const ticketNumber = slot === 0 ? 128 : slot === 1 ? 127 : 1 + (127 + (slot - 1) * 73) % 300;
  const person = Math.ceil(ticketNumber / 3);
  const demoNames = ['Mika Chen', '林小葳', '김서준', 'Alexandra Rivera · Renaiss Community'];
  return { slot, ticketNumber, participant: { name: demoNames[(person - 1) % demoNames.length],
    walletAddress: '', email: '', ticketRange: [person * 3 - 2, person * 3] } };
}

export function SurfDrawSimulation({ locale, onExit, initialAmount, initialKind }: { locale: AppLocale; onExit: () => void; initialAmount: number; initialKind: Prize['kind'] }) {
  const [run, setRun] = useState({ revision: 0, kind: initialKind });
  return <SurfDrawSimulationRun key={run.revision} locale={locale} prizes={publicPrizes} onExit={onExit}
    initialAmount={run.revision === 0 ? initialAmount : publicPrizes.filter(prize => prize.kind === run.kind).length} initialKind={run.kind}
    onRestart={(kind = 'mystery-box') => setRun(value => ({ revision: value.revision + 1, kind }))} />;
}

// Restarting this local component discards only its in-memory fixture. The
// provider retains decoded prize media, and no ledger/reset API is involved.
function SurfDrawSimulationRun({ locale, prizes, onExit, initialAmount, initialKind, onRestart }: {
  locale: AppLocale; prizes: Prize[]; onExit: () => void; initialAmount: number; initialKind: Prize['kind']; onRestart: (kind?: Prize['kind']) => void;
}) {
  const [results, setResults] = useState<Winner[]>([]);
  const [selectedKind, setSelectedKind] = useState(initialKind);
  const presentation = useSurfDrawPresentation(results);
  const pending = useRef<number | null>(null);
  const execute = useCallback(async (slots: number[]) => {
    if (pending.current !== null || !slots.length || results.length >= prizes.length) return false;
    pending.current = window.setTimeout(() => {
      pending.current = null;
      setResults(previous => [...previous, ...slots.map(simulatedSurfWinner)]);
    }, 700);
    return true;
  }, [results.length, prizes.length]);
  const batch = useSurfDrawBatch({ prizes, kind: selectedKind, visibleWinners: presentation.visibleWinners,
    confirmedWinners: results, phase: presentation.phase, canReveal: true,
    execute, begin: presentation.begin, cancel: presentation.cancel, initialAmount });

  useEffect(() => {
    return () => {
      if (pending.current !== null) window.clearTimeout(pending.current);
      pending.current = null;
    };
  }, []);

  return <SurfDrawBoard locale={locale} status={null} chain={null} prizes={prizes}
    selectedKind={selectedKind} onSelectKind={setSelectedKind} batchSlots={batch.slots}
    administrator={false} simulation onExitSimulation={onExit} onRestartSimulation={onRestart}
    visibleWinners={presentation.visibleWinners} phase={presentation.phase} elapsed={presentation.elapsed}
    settlingWinner={presentation.settlingWinner} onSettled={presentation.complete} onIdentityRevealed={presentation.revealIdentity}
    batchStart={presentation.batchStart} batchSize={presentation.batchSize} batchWinners={presentation.batchWinners}
    batchAmount={batch.amount} batchLimit={batch.limit} batchActive={batch.active} batchProgress={batch.progress} onBatchAmount={batch.setAmount}
    revision={presentation.revision} onSimulate={() => batch.start()} nextAction={null} pendingTx={undefined}
    busy={null} canAct={false} unavailable={null} now={0} error={null} notice={null}
    onAction={() => {}} onRefresh={() => {}} />;
}
