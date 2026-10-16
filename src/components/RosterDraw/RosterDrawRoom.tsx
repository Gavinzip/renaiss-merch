import { lazy, Suspense, useCallback, useRef, useState } from "react";
import type { AppLocale } from "../../i18n/LocaleContext";
import { RosterDrawHistory } from "./RosterDrawHistory";
import { RosterStatus } from "./RosterStatus";
import { useRosterDraw } from "./useRosterDraw";
import { RenaissPackDraw } from "./RenaissPackDraw";
import type { RosterKind, RosterWinner } from "./types";
import "./RosterDrawRoom.css";
import "./charizard/charizardEntrance.css";
import { DrawRoomHeading } from "../DrawRoom/DrawRoomHeading";
import { useDrawViewportStage } from "../DrawRoom/useDrawViewportStage";

const CharizardCeremony = lazy(
  () => import("./charizard/CharizardCeremony.jsx"),
);
const CharizardPrizePreview = lazy(
  () => import("./charizard/CharizardPrizePreview.jsx"),
);
export function RosterDrawRoom({
  kind,
  locale,
  onActive,
  visible,
  draw,
}: {
  kind: RosterKind;
  visible: boolean;
  draw: ReturnType<typeof useRosterDraw>;
  locale: AppLocale;
  onActive: (active: boolean) => void;
}) {
  const [preparationError, setPreparationError] = useState('');
  const [charizardReady, setCharizardReady] = useState(false);
  const charizardStage = useRef<HTMLElement>(null);
  useDrawViewportStage(charizardStage);
  const [run, setRun] = useState(0),
    [active, setActive] = useState(false),
    [holdingResult, setHoldingResult] = useState(false),
    [charizard, setCharizard] = useState<HTMLButtonElement | null>(null),
    [replay, setReplay] = useState<RosterWinner | undefined>();
  const activity = useCallback(
    (value: boolean) => {
      setActive(value);
      onActive(value);
    },
    [onActive],
  );
  const roster = draw.state?.roster,
    winners = draw.state?.winners ?? [],
    remaining = (roster?.entries.length ?? 0) - winners.length;
  const retryHere = draw.pendingDraw?.kind === kind;
  const retryElsewhere = Boolean(draw.pendingDraw && !retryHere);
  const title = kind === "charizard" ? "噴火龍抽獎" : "額外加碼";
  const prize = kind === "charizard" ? "噴火龍典藏禮盒" : "額外加碼";
  function close() {
    setCharizard(null);
    setReplay(undefined);
    activity(false);
  }
  function replayResult(winner: RosterWinner, button: HTMLButtonElement) {
    setReplay(winner);
    setRun((v) => v + 1);
    if (winner.kind === "charizard") setCharizard(button);
  }
  return (
    <section className="roster-room" data-kind={kind} aria-label={title}>
      <DrawRoomHeading title={title} eyebrow="RENAISS · ROSTER DRAW" />
      <div className="roster-draw-controls">
        <RosterStatus compact state={draw.state} refreshing={draw.refreshing} error={draw.error}
          disabled={draw.busy || active} onRefresh={draw.refresh} />
      </div>
      {draw.error ? (
        <div className="roster-error" role="alert">
          {draw.error}
          <button
            type="button"
            disabled={draw.busy || active}
            onClick={() => void draw.refresh()}
          >
            重新載入
          </button>
        </div>
      ) : null}
      {kind === "charizard" ? (
        <section ref={charizardStage} className="roster-charizard-invite" aria-label="噴火龍典藏禮盒">
          <div className="roster-charizard-info">
            <h2>噴火龍典藏禮盒</h2>
            <p>公仔 × 1 · 特大卡牌 × 1 · 補充包 × 15</p>
          </div>
          <div className="roster-charizard-model">
            <Suspense fallback={<p className="bonus-canvas-status" role="status">正在準備立體典藏禮盒…</p>}>
              <CharizardPrizePreview active={visible && !charizard} />
            </Suspense>
          </div>
          {preparationError ? <p className="roster-error" role="alert">{preparationError}</p> : null}
          <div className="roster-charizard-actions">
              <button type="button" className="roster-charizard-entry"
                disabled={!charizardReady || retryElsewhere || (!retryHere && (!roster || remaining <= 0)) || draw.busy || draw.refreshing}
                onClick={(event) => {
                  setReplay(undefined);
                  setCharizard(event.currentTarget);
                }}>
                {preparationError ? "準備失敗" : !charizardReady ? "準備中…" : "Reveal ↗"}
              </button>
          </div>
        </section>
      ) : null}
      {kind === "other" ? (
        <>
          <RenaissPackDraw
            revision={run}
            visible={visible}
            locale={locale}
            replay={replay?.kind === "other" ? replay : undefined}
            disabledReason={retryElsewhere ? "請先回到原獎項重試" : !draw.state ? (draw.error ? "請重新讀取名單" : "正在讀取名單…")
              : !roster && !retryHere ? "請先上傳名單" : remaining <= 0 && !holdingResult && !retryHere ? "已抽完"
                : draw.refreshing ? "正在讀取名單…" : undefined}
            onDraw={async () => {
              const result = await draw.draw("other", retryHere ? draw.pendingDraw!.prize : prize);
              setHoldingResult(true);
              return result;
            }}
            onActive={activity}
            onDone={() => {
              setReplay(undefined);
              setHoldingResult(false);
              setRun((v) => v + 1);
            }}
          />
        </>
      ) : null}
      {!active ? <RosterDrawHistory winners={draw.state?.history ?? []} kind={kind}
        busy={draw.busy} onReplay={replayResult} /> : null}
      {kind === "charizard" ? (
        <Suspense fallback={null}>
          <CharizardCeremony
            replay={replay}
            onReady={setCharizardReady}
            onPreparationError={setPreparationError}
            origin={charizard}
            onActive={activity}
            onClose={close}
            onDraw={() => draw.draw("charizard", "噴火龍典藏禮盒")}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
