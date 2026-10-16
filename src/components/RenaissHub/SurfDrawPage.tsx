import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { SurfDrawAccessGate } from './SurfDrawAccessGate';
import { SurfDrawBoard } from './SurfDrawBoard';
import { SurfDrawSimulation } from './SurfDrawSimulation';
import { SurfDrawMotionAssets } from './SurfDrawMotionAssets';
import { surfDrawCopy } from './SurfDrawCopy';
import { useSurfDraw, type Prize } from './useSurfDraw';
import { useSurfDrawAccess } from './useSurfDrawAccess';
import { isSurfRevealRunning, useSurfDrawPresentation } from './useSurfDrawPresentation';
import { useSurfDrawBatch } from './useSurfDrawBatch';
import { staticMerchAssetCssUrl } from '../../lib/staticAssets';
import './SurfDrawPage.css';
import { useRosterDraw } from '../RosterDraw/useRosterDraw';
import { RosterDrawRoom } from '../RosterDraw/RosterDrawRoom';
import { RosterManagementPage } from '../RosterDraw/RosterManagementPage';
import { drawRoomHashes, useDrawRoomRoute, type DrawRoomView } from '../RosterDraw/drawRoomRoute';
import { useDrawNavigationLock } from '../DrawRoom/useDrawNavigationLock';
import { canShowLocalSurfReset, LocalSurfReset } from '../DrawRoom/LocalSurfReset';
import { DrawSceneActivity } from '../DrawRoom/drawSceneActivity';

type PageProps = {
  locale: AppLocale;
};

function SurfDrawContent({ locale, mode, rosterActive, onActive }: PageProps & {
  mode: DrawRoomView; rosterActive: boolean; onActive: (kind: 'surf' | 'charizard' | 'other', active: boolean) => void;
}) {
  const [simulation, setSimulation] = useState<{ kind: Prize['kind'] } | null>(null);
  const [liveRevision, setLiveRevision] = useState(0);
  const activity = useMemo(() => ({
    surf: (active: boolean) => onActive('surf', active),
    charizard: (active: boolean) => onActive('charizard', active),
    other: (active: boolean) => onActive('other', active),
  }), [onActive]);
  const rosterDraw = useRosterDraw();
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current !== mode && mode !== 'surf') void rosterDraw.refresh();
    previousMode.current = mode;
  }, [mode, rosterDraw.refresh]);
  return <SurfDrawMotionAssets>
    <nav className="draw-room-modes" aria-label="開獎類型">
      {(['surf','charizard','other'] as const).map(item => <button type="button" key={item} aria-pressed={mode===item} disabled={rosterActive}
        onClick={()=> { window.location.hash = drawRoomHashes[item]; }}>{item==='surf'?'Surf 開獎':item==='charizard'?'噴火龍抽獎':'額外加碼'}</button>)}
      <button className="draw-room-modes__manage" type="button" aria-pressed={mode === 'roster'} disabled={rosterActive}
        onClick={() => { window.location.hash = drawRoomHashes.roster; }}>名單管理</button>
    </nav>
    <div className="draw-room-panels">
    {(['charizard', 'other'] as const).map(kind => <div key={kind} className="draw-room-panel"
      data-active={mode === kind} aria-hidden={mode !== kind} inert={mode !== kind}>
      <RosterDrawRoom kind={kind} locale={locale} visible={mode === kind} draw={rosterDraw} onActive={activity[kind]}/>
    </div>)}
    {mode === 'roster' ? <RosterManagementPage draw={rosterDraw}/> : null}
    <div className="draw-room-panel" data-active={mode === 'surf'} aria-hidden={mode !== 'surf'} inert={mode !== 'surf'}>
    <DrawSceneActivity.Provider value={mode === 'surf'}>
    {simulation ? <SurfDrawSimulation locale={locale} initialKind={simulation.kind}
      onExit={() => setSimulation(null)} /> :
      <SurfDrawLive key={liveRevision} onReset={() => setLiveRevision(value => value + 1)} locale={locale} onActive={activity.surf} onSimulate={kind => setSimulation({ kind })} />}
    </DrawSceneActivity.Provider>
    </div>
    </div>
  </SurfDrawMotionAssets>;
}

type LiveProps = PageProps & {
  onSimulate: (kind: Prize['kind']) => void;
  onActive: (active: boolean) => void;
  onReset: () => void;
};

function SurfDrawLive({ locale, onSimulate, onActive, onReset }: LiveProps) {
  const local = import.meta.env.DEV && canShowLocalSurfReset();
  const administrator = true; // The enclosing draw-room login is the operator login.
  const draw = useSurfDraw(administrator, local ? '/api/local/surf-operator/draw' : undefined);
  const [resetBusy, setResetBusy] = useState(false);
  const presentation = useSurfDrawPresentation(draw.chain?.winners);
  useEffect(() => { onActive(resetBusy || Boolean(draw.busy) || isSurfRevealRunning(presentation.phase));
    return () => onActive(false);
  }, [resetBusy, draw.busy, presentation.phase, onActive]);
  const [selectedKind, setSelectedKind] = useState<Prize['kind']>('mystery-box');
  useLayoutEffect(() => {
    if (!isSurfRevealRunning(presentation.phase)) return;
    const incomingKind = draw.prizes[presentation.batchStart]?.kind;
    if (incomingKind) setSelectedKind(incomingKind);
  }, [presentation.phase, presentation.batchStart, draw.prizes]);
  const batch = useSurfDrawBatch({ prizes: draw.prizes, kind: selectedKind,
    visibleWinners: presentation.visibleWinners, confirmedWinners: draw.chain?.winners ?? [],
    phase: presentation.phase, canReveal: !resetBusy && draw.canAct && draw.nextAction === 'reveal',
    failed: draw.unavailable === 'Previous transaction failed', execute: slots => draw.act('reveal', slots),
    begin: presentation.begin, cancel: presentation.cancel });
  function executeAction() {
    if (resetBusy || !draw.status || !draw.nextAction || !draw.canAct) return;
    const action = draw.nextAction;
    if (action === 'reveal' && !batch.slots.length) return;
    if (action === 'reveal') batch.start();
    else void draw.act(action);
  }

  return <>
    <fieldset className="draw-live-controls" disabled={resetBusy}>
    <SurfDrawBoard locale={locale} status={draw.status} chain={draw.chain} prizes={draw.prizes}
        selectedKind={selectedKind} onSelectKind={setSelectedKind} batchSlots={batch.slots}
        administrator={administrator}
        visibleWinners={presentation.visibleWinners} phase={presentation.phase} elapsed={presentation.elapsed}
        settlingWinner={presentation.settlingWinner} onSettled={presentation.complete} onIdentityRevealed={presentation.revealIdentity}
        batchStart={presentation.batchStart} batchSize={presentation.batchSize} batchWinners={presentation.batchWinners}
        batchAmount={batch.amount} batchLimit={batch.limit} batchActive={batch.active} batchProgress={batch.progress}
        revision={presentation.revision} onSimulate={onSimulate}
        nextAction={draw.nextAction} pendingTx={draw.pendingTx} busy={draw.busy} canAct={draw.canAct && !resetBusy}
        unavailable={draw.unavailable} now={draw.now} error={draw.error} notice={draw.notice}
        onAction={executeAction} onRefresh={() => void draw.refresh()} />
    </fieldset>
    <LocalSurfReset authenticated={administrator}
      drawBusy={Boolean(draw.busy) || isSurfRevealRunning(presentation.phase)}
      root={local ? '/api/local/surf-operator/draw' : '/api/admin/missions/surf/draw'}
      online={!local} onComplete={onReset} onBusyChange={setResetBusy} />
  </>;
}

export function SurfDrawPage({ locale }: PageProps) {
  const access = useSurfDrawAccess();
  const [activity, setActivity] = useState({ surf: false, charizard: false, other: false });
  const drawActive = Object.values(activity).some(Boolean);
  const setDrawActive = useCallback((kind: keyof typeof activity, active: boolean) => {
    setActivity(previous => previous[kind] === active ? previous : { ...previous, [kind]: active });
  }, []);
  useDrawNavigationLock(drawActive);
  const view = useDrawRoomRoute();
  const copy = surfDrawCopy(locale);
  const location = view === 'roster' ? '名單管理' : view === 'charizard' ? '噴火龍抽獎' : view === 'other' ? '額外加碼' : copy.location;
  useEffect(() => {
    const previous = document.title;
    document.title = `Renaiss | ${location}`;
    window.scrollTo({ top: 0, behavior: 'instant' });
    return () => { document.title = previous; };
  }, [location, view]);

  return <main className="surf-draw-page draw-site" lang={locale} style={{ '--draw-site-background': staticMerchAssetCssUrl('storeBackground') } as CSSProperties}>
    <div className="surf-draw-page__shell">
      {access.state.status === 'ready' ? <button className="draw-site-exit" type="button"
        disabled={access.busy || drawActive} onClick={() => void access.logout()}>
        {locale === 'zh-TW' ? '退出開獎室' : locale === 'ko' ? '추첨실 나가기' : 'Leave draw room'}
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4H4v12h4M11 6l4 4-4 4M7 10h8" /></svg>
      </button> : null}
      {access.state.status === 'ready' ? <>
        {access.error ? <p className="surf-draw-feedback" role="alert">{locale === 'zh-TW' ? '無法登出開獎室，請重試。' : locale === 'ko' ? '추첨실에서 로그아웃할 수 없습니다. 다시 시도하세요.' : 'Could not leave the draw room. Try again.'}</p> : null}
        <SurfDrawContent key={access.state.username} mode={view} locale={locale}
          rosterActive={drawActive} onActive={setDrawActive} />
      </> : <SurfDrawAccessGate locale={locale} access={access} />}

    </div>
  </main>;
}
