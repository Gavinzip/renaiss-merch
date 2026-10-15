import type { RosterKind, RosterWinner } from './types';

function exportResults(winners: RosterWinner[]) {
  const cell = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" : '') + value.replaceAll('"', '""')}"`;
  const csv = '\uFEFFname,prize,time\r\n' + [...winners].reverse()
    .map(w => [w.name, w.prize, w.drawnAt].map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'renaiss-draw-results.csv'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saved results remain visible even after the active roster is replaced. */
export function RosterDrawHistory({ winners, kind, busy, onReplay }: {
  winners: RosterWinner[]; kind: RosterKind; busy: boolean;
  onReplay: (winner: RosterWinner, button: HTMLButtonElement) => void;
}) {
  const results = winners.filter(winner => winner.kind === kind);
  if (!results.length) return null;
  return <section className="roster-history">
    <header><h2>中獎紀錄</h2><button type="button" onClick={() => exportResults(results)}>下載 CSV ↗</button></header>
    <div className="roster-history__rows">{results.map(winner => <div key={winner.requestId}>
      <time dateTime={winner.drawnAt}>{new Date(winner.drawnAt).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</time>
      <div><strong>{winner.name}</strong></div><span>{winner.prize}</span>
      <button type="button" disabled={busy} onClick={event => onReplay(winner, event.currentTarget)}>重播 ↗</button>
    </div>)}</div>
  </section>;
}
