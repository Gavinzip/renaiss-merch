import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import type { AccountState } from './RenaissHubFeatures';
import { HubAccountAction } from './HubAccountAction';
import { HubNavigation } from './HubNavigation';
import { HubSiteHeader } from './HubSiteHeader';
import { SurfDrawAccessGate } from './SurfDrawAccessGate';
import { SurfDrawBoard } from './SurfDrawBoard';
import { SurfDrawSimulation } from './SurfDrawSimulation';
import { SurfDrawMotionAssets } from './SurfDrawMotionAssets';
import { actionName, prizeName, surfDrawCopy } from './SurfDrawCopy';
import { publicPrizes, useSurfDraw, type Prize } from './useSurfDraw';
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

type PageProps = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  account: AccountState;
  onBack: () => void;
  onHome: () => void;
  onEnterMerch: () => void;
  onLogin: () => void;
  onRetry: () => void;
  onLogout: () => void;
  loggingOut: boolean;
};

function SurfDrawContent({ locale, account, mode, rosterActive, onActive }: Pick<PageProps, 'locale' | 'account'> & {
  mode: DrawRoomView; rosterActive: boolean; onActive: (kind: 'surf' | 'charizard' | 'other', active: boolean) => void;
}) {
  const [simulation, setSimulation] = useState<{ kind: Prize['kind']; amount: number } | null>(null);
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
      <button className="draw-room-modes__manage" type="button" disabled={rosterActive}
        onClick={() => { window.location.hash = drawRoomHashes.roster; }}>名單管理 ↗</button>
    </nav>
    <div className="draw-room-panels">
    {(['charizard', 'other'] as const).map(kind => <div key={kind} className="draw-room-panel"
      data-active={mode === kind} aria-hidden={mode !== kind} inert={mode !== kind}>
      <RosterDrawRoom kind={kind} locale={locale} visible={mode === kind} draw={rosterDraw} onActive={activity[kind]}/>
    </div>)}
    {mode === 'roster' ? <RosterManagementPage draw={rosterDraw}/> : null}
    {mode === 'surf' ? simulation ? <SurfDrawSimulation locale={locale} initialAmount={simulation.amount} initialKind={simulation.kind}
      onExit={() => setSimulation(null)} /> :
      <SurfDrawLive locale={locale} account={account} onActive={activity.surf} onSimulate={(kind, amount) => setSimulation({ kind,
        amount: amount && amount > 0 ? amount : publicPrizes.filter(prize => prize.kind === kind).length })} /> : null}
    </div>
  </SurfDrawMotionAssets>;
}

function SurfDrawLive({ locale, account, onSimulate, onActive }: Pick<PageProps, 'locale' | 'account'> & {
  onSimulate: (kind: Prize['kind'], amount?: number) => void;
  onActive: (active: boolean) => void;
}) {
  const administrator = account.status === 'ready' && account.session.authenticated &&
    account.session.user.canManageFulfillment && !account.session.user.isDemo;
  const draw = useSurfDraw(administrator);
  const presentation = useSurfDrawPresentation(draw.chain?.winners);
  useEffect(() => { onActive(Boolean(draw.busy) || isSurfRevealRunning(presentation.phase));
    return () => onActive(false);
  }, [draw.busy, presentation.phase, onActive]);
  const [selectedKind, setSelectedKind] = useState<Prize['kind']>('mystery-box');
  useLayoutEffect(() => {
    if (!isSurfRevealRunning(presentation.phase)) return;
    const incomingKind = draw.prizes[presentation.batchStart]?.kind;
    if (incomingKind) setSelectedKind(incomingKind);
  }, [presentation.phase, presentation.batchStart, draw.prizes]);
  const batch = useSurfDrawBatch({ prizes: draw.prizes, kind: selectedKind,
    visibleWinners: presentation.visibleWinners, confirmedWinners: draw.chain?.winners ?? [],
    phase: presentation.phase, canReveal: draw.canAct && draw.nextAction === 'reveal',
    failed: draw.unavailable === 'Previous transaction failed', execute: slots => draw.act('reveal', slots),
    begin: presentation.begin, cancel: presentation.cancel });
  const copy = surfDrawCopy(locale);

  function confirmAction() {
    if (!draw.status || !draw.nextAction || !draw.canAct) return;
    const action = draw.nextAction;
    if (action === 'reveal' && !batch.slots.length) return;
    const hash = draw.status.snapshot?.ledgerHash || draw.status.candidate?.ledgerHash;
    const prize = draw.prizes[batch.slots[0]];
    const detail = action === 'reveal' && prize
      ? `${prizeName(prize, locale)} × ${batch.amount}\n${locale === 'zh-TW' ? '這一批指定獎位將由合約在同一筆交易中開出。' : locale === 'ko' ? '선택한 경품은 한 번의 계약 거래로 추첨됩니다.' : 'The selected prize slots are drawn in one contract transaction.'}`
      : `Draw ID: ${draw.status.drawId}\nLedger hash: ${hash}`;
    if (!window.confirm(`${copy.confirm}: ${actionName(action, locale)}?\n\n${detail}\n\n${action === 'prepare' ? copy.snapshotEffect : copy.chainEffect}`)) return;
    if (action === 'reveal') batch.start();
    else void draw.act(action);
  }

  return <SurfDrawBoard locale={locale} status={draw.status} chain={draw.chain} prizes={draw.prizes}
        selectedKind={selectedKind} onSelectKind={setSelectedKind} batchSlots={batch.slots}
        administrator={administrator}
        visibleWinners={presentation.visibleWinners} phase={presentation.phase} elapsed={presentation.elapsed}
        settlingWinner={presentation.settlingWinner} onSettled={presentation.complete} onIdentityRevealed={presentation.revealIdentity}
        batchStart={presentation.batchStart} batchSize={presentation.batchSize} batchWinners={presentation.batchWinners}
        batchAmount={batch.amount} batchLimit={batch.limit} batchActive={batch.active} batchProgress={batch.progress} onBatchAmount={batch.setAmount}
        revision={presentation.revision} onSimulate={onSimulate}
        nextAction={draw.nextAction} pendingTx={draw.pendingTx} busy={draw.busy} canAct={draw.canAct}
        unavailable={draw.unavailable} now={draw.now} error={draw.error} notice={draw.notice}
        onAction={confirmAction} onRefresh={() => void draw.refresh()} />;
}

export function SurfDrawPage({ locale, setLocale, account, onBack, onHome, onEnterMerch, onLogin, onRetry, onLogout, loggingOut }: PageProps) {
  const access = useSurfDrawAccess();
  const [activity, setActivity] = useState({ surf: false, charizard: false, other: false });
  const drawActive = Object.values(activity).some(Boolean);
  const setDrawActive = useCallback((kind: keyof typeof activity, active: boolean) => {
    setActivity(previous => previous[kind] === active ? previous : { ...previous, [kind]: active });
  }, []);
  useDrawNavigationLock(drawActive);
  const view = useDrawRoomRoute();
  const copy = surfDrawCopy(locale);
  const location = view === 'roster' ? '名單管理' : copy.location;
  useEffect(() => {
    const previous = document.title;
    document.title = `Renaiss × Surf | ${location}`;
    window.scrollTo({ top: 0, behavior: 'instant' });
    return () => { document.title = previous; };
  }, [location, view]);

  return <main className="surf-draw-page" lang={locale} style={{ '--draw-site-background': staticMerchAssetCssUrl('storeBackground') } as CSSProperties}>
    <div className="surf-draw-page__shell">
      <HubSiteHeader inert={drawActive} locale={locale} setLocale={setLocale} location={location}
        onBack={view === 'roster' ? () => { window.location.hash = drawRoomHashes.other; } : onBack}
        navigation={<HubNavigation locale={locale} onOpenCampaign={onBack} onEnterMerch={onEnterMerch}
          onGoHome={onHome} preparing={false} disabled={false} />}
        actions={access.state.status === 'ready' ? <button className="surf-draw-access-exit" type="button" disabled={access.busy}
          title={access.state.username} onClick={() => void access.logout()}>{locale === 'zh-TW' ? '退出開獎室' : locale === 'ko' ? '추첨실 나가기' : 'Leave draw room'}</button> : undefined}
        accountAction={<HubAccountAction account={account} locale={locale} onRetry={onRetry} onLogin={onLogin}
          onLogout={onLogout} loggingOut={loggingOut} disabled={false} />} />
      {access.state.status === 'ready' ? <>
        {access.error ? <p className="surf-draw-feedback" role="alert">{locale === 'zh-TW' ? '無法登出開獎室，請重試。' : locale === 'ko' ? '추첨실에서 로그아웃할 수 없습니다. 다시 시도하세요.' : 'Could not leave the draw room. Try again.'}</p> : null}
        <SurfDrawContent key={access.state.username} mode={view} locale={locale} account={account}
          rosterActive={drawActive} onActive={setDrawActive} />
      </> : <SurfDrawAccessGate locale={locale} access={access} />}
      <footer className="surf-draw-page__footer">
        <div><strong>Renaiss × Surf</strong>{view === 'surf' ? <p>{copy.oneWin}</p> : null}</div>
        <button type="button" disabled={drawActive} onClick={onBack}>{copy.back}<span aria-hidden="true">↗</span></button>
      </footer>
    </div>
  </main>;
}
