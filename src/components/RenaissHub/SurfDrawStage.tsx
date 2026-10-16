import { useCallback, useRef, useState } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { SurfLogo } from './SurfLogo';
import { actionName } from './SurfDrawCopy';
import { surfDrawSceneCopy } from './SurfDrawSceneCopy';
import { SurfDrawBatchScene } from './SurfDrawBatchScene';
import type { SurfDrawMediaState } from './surfDrawMedia';
import { SurfDrawCinema } from './SurfDrawCinema';
import { useSurfDrawTheater } from './useSurfDrawTheater';
import { useSurfDrawMotionAssets } from './surfDrawMotionContext';
import type { DrawAction, DrawStatus, Prize, Winner } from './useSurfDraw';
import { isSurfRevealRunning, type RevealPhase } from './useSurfDrawPresentation';
import { DrawRoomHeading } from '../DrawRoom/DrawRoomHeading';
import { useDrawViewportStage } from '../DrawRoom/useDrawViewportStage';
import { unlockSurfDrawSound } from './surfDrawSound';

type Props = {
  locale: AppLocale; prize: Prize; winner?: Winner; phase: RevealPhase; simulation: boolean;
  selectedKind: Prize['kind']; onSelectKind: (kind: Prize['kind']) => void; prizes: Prize[]; visibleWinners: Winner[];
  elapsed: number; revision: number; nextAction: DrawAction | null; canAct: boolean;
  settlingWinner?: Winner; onSettled: () => void; onIdentityRevealed: () => void; nextPrize?: Prize;
  batchAmount: number; batchLimit: number; batchActive: boolean;
  batchStart: number; batchSize: number; batchWinners: Winner[];
  batchProgress: { current: number; total: number } | null;
  busy: DrawAction | null; chainState?: number; revealedCount: number; administrator: boolean;
  unavailable: string | null; myTickets: DrawStatus['myTickets'];
  onAction: () => void; onSimulate: () => void; onExitSimulation?: () => void; onRestartSimulation?: (kind?: Prize['kind']) => void;
  executionError?: string | null;
};

export function SurfDrawStage(props: Props) {
  const { locale, prize, winner, phase, simulation, elapsed, revision, nextAction, canAct, busy, chainState,
    selectedKind, onSelectKind, prizes, visibleWinners,
    revealedCount, administrator, unavailable, onAction, onSimulate, onExitSimulation, onRestartSimulation,
    settlingWinner, onSettled, onIdentityRevealed, batchAmount, batchLimit, batchActive, batchProgress, nextPrize,
    batchStart, batchSize, batchWinners, executionError } = props;
  const copy = surfDrawSceneCopy(locale);
  const motionAssets = useSurfDrawMotionAssets();
  const [mediaReady, setMediaReady] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const multiple = batchSize > 1;
  const stage = useRef<HTMLElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  useDrawViewportStage(stage);
  const nextMedia = nextPrize?.kind === 'surf-pro-month' ? motionAssets.card : motionAssets.box;
  const ready = mediaReady && (!nextPrize || nextMedia.ready) && sceneReady && !sceneError;
  const locked = isSurfRevealRunning(phase) || batchActive;
  // Keep the pack animation in the theater, then let the card grid use the page.
  // Controls stay locked until every card has finished revealing.
  const theaterActive = locked && phase !== 'identity' && phase !== 'revealed';
  useSurfDrawTheater(stage, slot, theaterActive, phase === 'identity');
  const confirmedWinner = settlingWinner || winner;
  const ceremonyWinners = multiple ? batchWinners : confirmedWinner ? [confirmedWinner] : [];
  const onPrizeStatus = useCallback((state: SurfDrawMediaState) => setMediaReady(state.ready), []);
  const onSceneReady = useCallback(() => { setSceneReady(true); setSceneError(null); }, []);
  const onSceneError = useCallback((message: string) => { setSceneReady(false); setSceneError(message); }, []);
  const simulationLabel = simulation && nextPrize ? locale === 'zh-TW'
    ? `模擬開出 ${batchAmount} ${nextPrize.kind === 'mystery-box' ? '個寶箱' : '份 Pro Membership'}`
    : locale === 'ko' ? `${nextPrize.kind === 'mystery-box' ? 'Mystery Box' : 'Pro Membership'} ${batchAmount}개 시뮬레이션`
    : `Simulate ${batchAmount} ${nextPrize.kind === 'mystery-box' ? 'Mystery Boxes' : 'Pro Memberships'}`
    : `${copy.simulate} · ${batchAmount}`;

  return <>
    <SurfDrawCinema phase={phase} stops={0} revision={revision} batch proBatch={prize.kind === 'surf-pro-month'} onReady={onSceneReady} onError={onSceneError} />
    <DrawRoomHeading id="surf-draw-title" title={copy.title}
      eyebrow={<><SurfLogo />SURF × RENAISS</>}
      subtitle={simulation ? copy.simulationNote : copy.subtitle}
      status={<><span>{simulation ? copy.simulation : copy.live}</span><strong>{String(revealedCount).padStart(2, '0')} <small>/ 27</small></strong></>} />

    <div ref={slot} className="surf-reveal-stage-slot">
    <section ref={stage} className="surf-reveal-stage" data-phase={phase} data-kind={prize.kind} data-batch data-simulation={simulation} data-ready={ready} data-spin-ms={Math.round(elapsed)}
      onClickCapture={unlockSurfDrawSound}
      onPointerDownCapture={unlockSurfDrawSound}
      aria-label={copy.title}>
      <SurfDrawBatchScene locale={locale} prize={prize} amount={batchSize} start={multiple ? batchStart : prize.slot} winners={ceremonyWinners}
        selectedKind={selectedKind} onSelectKind={onSelectKind} prizes={prizes} visibleWinners={visibleWinners} selectionDisabled={locked || Boolean(busy)}
        phase={phase} revision={revision} simulation={simulation} progress={batchProgress} onStatus={onPrizeStatus}
        onSettled={onSettled} onRevealed={onIdentityRevealed} />
      <div className="surf-reveal-controls">
        {administrator ? <button className="surf-reveal-button" type="button" disabled={!canAct || locked || !ready || (nextAction === 'reveal' && !batchLimit)} onClick={onAction}>
          <span>{busy ? locale === 'zh-TW' ? '確認交易中' : 'Confirming' : nextAction ? `${actionName(nextAction, locale)}${nextAction === 'reveal' ? ` · ${batchAmount}` : ''}` : copy.phase[chainState ?? 0]}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
        </button> : null}
        {simulation ? <button className="surf-reveal-button" type="button"
          disabled={locked || !ready || !batchLimit || revealedCount >= 27} onClick={onSimulate}><span>{locked ? copy.simulating : revealedCount >= 27 ? copy.simulationComplete : simulationLabel}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 10 7-10 7Z" /></svg></button>
          : null}
        {simulation ? <div className="surf-reveal-preview-links">
          {simulation && onRestartSimulation ? <button className="surf-reveal-exit surf-reveal-preview-kind" type="button" onClick={() => onRestartSimulation()}>{locale === 'zh-TW' ? '重播寶箱' : locale === 'ko' ? 'Mystery Boxes 다시 보기' : 'Replay Mystery Boxes'} ↺</button> : null}
          {simulation && onRestartSimulation ? <button className="surf-reveal-exit surf-reveal-preview-kind" type="button" onClick={() => onRestartSimulation('surf-pro-month')}>{locale === 'zh-TW' ? '重播會員' : locale === 'ko' ? '멤버십 팩 다시 보기' : 'Replay Memberships'} ↺</button> : null}
          {simulation ? <button className="surf-reveal-exit" type="button" onClick={onExitSimulation}>{copy.simulationExit} ↗</button> : null}
        </div> : null}
        {executionError ? <p className="surf-reveal-scene-error" role="alert">{executionError}</p> : null}
        {nextPrize && nextMedia.error ? <p className="surf-reveal-scene-error" role="alert">{locale === 'zh-TW' ? '下一批獎品動畫載入失敗' : 'The next prize motion could not load'}<small>{nextMedia.error}</small><button className="surf-reveal-scene-retry" type="button" onClick={motionAssets.retry}>{locale === 'zh-TW' ? '重試' : 'Retry'}</button></p> : null}
        {sceneError ? <p className="surf-reveal-scene-error" role="alert">{locale === 'zh-TW' ? '開獎場景準備失敗，請重新載入。' : locale === 'ko' ? '추첨 장면 준비에 실패했습니다. 새로고침해 주세요.' : 'The draw scene could not prepare. Please reload.'}<small>{sceneError}</small><button className="surf-reveal-scene-retry" type="button" onClick={() => window.location.reload()}>{locale === 'zh-TW' ? '重新載入' : locale === 'ko' ? '새로고침' : 'Reload'}</button></p>
          : <p>{!ready ? copy.preparing : simulation ? copy.simulationNote : administrator && unavailable ? unavailable : copy.rule}</p>}
        {!simulation && batchLimit > 0 && administrator ? <p className="surf-reveal-controls__group">{selectedKind === 'mystery-box'
          ? locale === 'zh-TW' ? `Mystery Box 剩餘 ${batchLimit} 個` : locale === 'ko' ? `Mystery Box ${batchLimit}개 남음` : `${batchLimit} Mystery Boxes left`
          : locale === 'zh-TW' ? `Pro Membership 剩餘 ${batchLimit} 個` : locale === 'ko' ? `Pro Membership ${batchLimit}개 남음` : `${batchLimit} Pro Memberships left`}</p> : null}
      </div>
    </section>
    </div>
  </>;
}
