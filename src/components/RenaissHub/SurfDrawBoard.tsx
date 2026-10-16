import type { AppLocale } from '../../i18n/LocaleContext';
import { SurfDrawStage } from './SurfDrawStage';
import { actionName, surfDrawCopy } from './SurfDrawCopy';
import { surfDrawSceneCopy } from './SurfDrawSceneCopy';
import type { Chain, DrawAction, DrawStatus, Prize, Winner } from './useSurfDraw';
import { isSurfRevealRunning, type RevealPhase } from './useSurfDrawPresentation';
import { surfWinnerDisplayName } from '../../../shared/surf-draw-identity.js';

type BoardProps = {
  locale: AppLocale; status: DrawStatus | null; chain: Chain | null | undefined; prizes: Prize[];
  selectedKind: Prize['kind']; onSelectKind: (kind: Prize['kind']) => void; batchSlots: number[];
  nextAction: DrawAction | null; pendingTx: DrawStatus['transactions'][number] | undefined;
  busy: DrawAction | null; canAct: boolean; administrator: boolean; unavailable: string | null;
  now: number; error: string | null; notice: string | null;
  visibleWinners: Winner[]; phase: RevealPhase; elapsed: number; revision: number;
  settlingWinner?: Winner; onSettled: () => void; onIdentityRevealed: () => void;
  batchAmount: number; batchLimit: number; batchActive: boolean;
  batchStart: number; batchSize: number; batchWinners: Winner[];
  batchProgress: { current: number; total: number } | null;
  simulation?: boolean; onExitSimulation?: () => void; onRestartSimulation?: (kind?: Prize['kind']) => void;
  onAction: () => void; onRefresh: () => void; onSimulate: (kind: Prize['kind']) => void;
};

export function SurfDrawBoard(props: BoardProps) {
  const { locale, status, chain, prizes, nextAction, pendingTx, busy, canAct, administrator,
    selectedKind, onSelectKind, batchSlots,
    unavailable, now, error, notice, visibleWinners, settlingWinner, phase, elapsed, revision, simulation = false,
    batchAmount, batchLimit, batchActive, batchProgress, onSettled, onIdentityRevealed,
    batchStart, batchSize, batchWinners,
    onExitSimulation, onRestartSimulation, onAction, onRefresh, onSimulate } = props;
  const copy = surfDrawCopy(locale);
  const scene = surfDrawSceneCopy(locale);
  const moving = isSurfRevealRunning(phase);
  const groupPrizes = prizes.filter(item => item.kind === selectedKind);
  const groupWinners = visibleWinners.filter(winner => prizes[winner.slot]?.kind === selectedKind).sort((a, b) => a.slot - b.slot);
  const selectedWinner = groupWinners.at(-1);
  const prize = moving ? prizes[batchSlots[0]] || groupPrizes[0] : selectedWinner ? prizes[selectedWinner.slot] : prizes[batchSlots[0]] || groupPrizes[0];
  const scenePhase = moving ? phase : selectedWinner ? 'revealed' : 'idle';
  const presentingBatch = moving || batchActive;
  const sceneWinners = presentingBatch ? batchWinners : groupWinners;
  const sceneStart = presentingBatch ? batchStart : groupPrizes[0]?.slot ?? 0;
  const sceneSize = presentingBatch ? batchSize : groupWinners.length || batchAmount || 1;
  const reason = unavailable === 'Formal draw disabled' ? copy.reasons.disabled :
    unavailable === 'Campaign not closed' ? copy.reasons.open : unavailable === 'Chain unavailable' ? copy.reasons.chain :
    unavailable === 'Previous transaction pending' ? copy.reasons.pending : unavailable === 'Previous transaction failed' ? copy.reasons.failed :
    unavailable === 'Server signer missing' ? copy.reasons.signer : unavailable === 'Server signer not authorized' ? copy.reasons.admin :
    unavailable === 'Not enough eligible tickets' ? copy.reasons.tickets :
    unavailable === 'Reveal contract not configured' ? copy.reasons.results : unavailable;

  return <>
    <SurfDrawStage locale={locale} prize={prize} winner={selectedWinner} settlingWinner={settlingWinner} onSettled={onSettled} onIdentityRevealed={onIdentityRevealed}
      batchAmount={batchAmount} batchLimit={batchLimit} batchActive={batchActive} batchProgress={batchProgress}
      batchStart={sceneStart} batchSize={sceneSize} batchWinners={sceneWinners}
      nextPrize={prizes[batchSlots[0]]} phase={scenePhase} simulation={simulation} elapsed={elapsed}
      selectedKind={selectedKind} onSelectKind={onSelectKind} prizes={prizes} visibleWinners={visibleWinners}
      revision={revision} nextAction={nextAction} canAct={canAct} busy={busy} chainState={chain?.state}
      revealedCount={visibleWinners.length} administrator={administrator} unavailable={reason} myTickets={status?.myTickets ?? null}
      onAction={onAction} onSimulate={() => onSimulate(selectedKind)} onExitSimulation={onExitSimulation}
      onRestartSimulation={onRestartSimulation ?? (kind => onSimulate(kind ?? 'mystery-box'))}
      executionError={error} />

    {error ? <div className="surf-draw-feedback" role="alert"><span>{error}</span><button type="button" onClick={onRefresh}>{copy.reload} ↻</button></div> : null}
    {notice && administrator ? <p className="surf-draw-feedback" role="status">{notice}</p> : null}
    {status?.actionLock && administrator ? <p className="surf-draw-feedback" role="status">{status.actionLock.recoverable ? copy.actionRecoverable : copy.actionPreparing} · {Math.max(0, Math.floor((now - Date.parse(status.actionLock.createdAt)) / 1000))}s</p> : null}
    {pendingTx && administrator ? <p className="surf-draw-feedback"><span>{copy.transactionConfirming} · {Math.max(0, Math.floor((now - Date.parse(pendingTx.createdAt)) / 1000))}s</span><a href={`https://bscscan.com/tx/${pendingTx.txHash}`} target="_blank" rel="noopener noreferrer">{short(pendingTx.txHash)} ↗</a></p> : null}

    <section className="surf-draw-results draw-entry" aria-labelledby="surf-draw-results-title">
      <div className="surf-draw-results__heading"><div><span>{simulation ? 'DEMO MODE' : 'THE REVEALS'}</span><h2 id="surf-draw-results-title">{simulation ? scene.simulationResults : scene.results}</h2></div>
        {status?.myTickets ? <p>{scene.tickets} <strong>#{status.myTickets.start}{status.myTickets.end > status.myTickets.start ? `–#${status.myTickets.end}` : ''}</strong></p> : null}
      </div>
      <div className="surf-draw-results__groups" aria-label={copy.prizeBoard}>
        {(['mystery-box', 'surf-pro-month'] as const).map(kind => {
          const winners = visibleWinners.filter(winner => prizes[winner.slot]?.kind === kind).sort((a, b) => a.slot - b.slot);
          const total = kind === 'mystery-box' ? 7 : 20;
          return <section className="surf-draw-results__group" key={kind} aria-label={kind === 'mystery-box' ? scene.boxCount : scene.proCount}>
            <div className="surf-draw-results__group-heading">
              <h3>{kind === 'mystery-box' ? scene.boxCount : scene.proCount} <small>{String(winners.length).padStart(2, '0')} / {String(total).padStart(2, '0')}</small></h3>
              {winners.length ? <button type="button" disabled={moving || batchActive || Boolean(busy)} onClick={() => {
                onSelectKind(kind);
                document.querySelector('.surf-reveal-stage-slot')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
              }}>{locale === 'zh-TW' ? '查看卡片' : locale === 'ko' ? '카드 보기' : 'View cards'} ↗</button> : null}
            </div>
            {winners.length ? <ol className="surf-draw-results__list">{winners.map(winner => {
              const mine = status?.myTickets && winner.ticketNumber >= status.myTickets.start && winner.ticketNumber <= status.myTickets.end;
              return <li key={winner.slot} data-mine={Boolean(mine)}><span>{String(winner.slot + 1).padStart(2, '0')}</span>
                <strong>{mine ? copy.youWon : surfWinnerDisplayName(winner.participant.name) || scene.nameUnavailable}</strong>
                <small>{copy.ticket} #{winner.ticketNumber}</small></li>;
            })}</ol> : null}
          </section>;
        })}
      </div>
    </section>

    {!simulation ? <details className="surf-draw-proof">
      <summary><span><i />{scene.verify}</span><small>BSC · VRF <b>+</b></small></summary>
      <div className="surf-draw-proof__body">
        <dl><div><dt>{copy.chainStage}</dt><dd>{chain ? copy.states[chain.state] : copy.cannotRead} · BSC #{chain?.block.toLocaleString('en-US') ?? '—'}</dd></div>
          <div><dt>{copy.requestId}</dt><dd>{chain?.requestId !== '0' ? chain?.requestId || copy.noRequest : copy.noRequest}</dd></div>
          <div><dt>DRAW ID</dt><dd><code>{status?.drawId || '—'}</code></dd></div>
          {status?.superseded ? <div><dt>{locale === 'zh-TW' ? '已作廢舊輪' : 'Superseded round'}</dt><dd>
            <code>{status.superseded.drawId}</code> · BSC #{status.superseded.observedBlock.toLocaleString('en-US')} · <a href={`https://bscscan.com/tx/${status.superseded.requestTxHash}`}
              target="_blank" rel="noopener noreferrer">{locale === 'zh-TW' ? '舊請求紀錄' : 'Old request'} ↗</a>
          </dd></div> : null}
          <div><dt>{copy.source}</dt><dd>{chain?.source ? <a href={`https://bscscan.com/address/${chain.source}#code`} target="_blank" rel="noopener noreferrer">{chain.source} ↗</a> : copy.notSet}</dd></div>
          <div><dt>{copy.results}</dt><dd>{chain?.results?.address ? <a href={`https://bscscan.com/address/${chain.results.address}#code`} target="_blank" rel="noopener noreferrer">{chain.results.address} ↗</a> : copy.notSet}</dd></div>
          {chain?.sourceState !== undefined && chain.sourceState !== chain.state ? <div><dt>{copy.sourceStage}</dt><dd>{copy.states[chain.sourceState]}</dd></div> : null}
          <div><dt>{copy.ledgerHash}</dt><dd><code>{status?.snapshot?.ledgerHash || copy.notLocked}</code></dd></div>
          <div><dt>{copy.participants}</dt><dd>{status?.snapshot?.participants ?? status?.candidate?.participants ?? '—'} · {status?.snapshot?.tickets ?? status?.candidate?.tickets ?? '—'} {copy.tickets}</dd></div>
          {administrator ? <div><dt>{copy.signer}</dt><dd>{chain?.signerAddress || copy.notSet}{chain?.signerAdmin === false ? ` · ${copy.needsAdmin}` : ''}</dd></div> : null}
          {administrator && chain?.vrf.subscription ? <div><dt>VRF</dt><dd>#{chain.vrf.subscription.id} · {chain.vrf.subscription.balanceWei} wei · {chain.vrf.subscription.consumerRegistered ? 'Consumer ✓' : 'Consumer ×'}</dd></div> : null}
          {administrator && chain?.vrf.provider === 'chainlink-v2.5' ? <div><dt>VRF</dt><dd>Chainlink v2.5 · Direct funding · {chain.vrf.directPriceWei} wei</dd></div> : null}
        </dl>
        {administrator ? <div className="surf-draw-proof__transactions"><h3>{copy.transactions}</h3>{status?.transactions.length ? status.transactions.map(tx =>
          <p key={tx.txHash}><span>{tx.action.startsWith('reveal:') ? `${scene.prize} ${tx.action.slice(7).split(',').map(slot => Number(slot) + 1).join(', ')}` : actionName(tx.action as DrawAction, locale)}</span>
            <a href={`https://bscscan.com/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer">{short(tx.txHash)} ↗</a>
            <small>{tx.confirmedAt ? tx.receiptStatus === 1 ? copy.confirmed : copy.failed : tx.broadcastState === 'uncertain' ? copy.uncertain : copy.awaiting}</small></p>) : <p>{copy.noTransactions}</p>}</div> : null}
      </div>
    </details> : null}
  </>;
}
function short(value: string) { return `${value.slice(0, 10)}…${value.slice(-8)}`; }
