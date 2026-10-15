import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AppLocale } from "../../i18n/LocaleContext";
import type { RevealPhase } from "../RenaissHub/useSurfDrawPresentation";
import { useSurfDrawMotionAssets } from "../RenaissHub/surfDrawMotionContext";
import { useSurfBatchFlight } from "../RenaissHub/useSurfBatchFlight";
import { SurfProBoosterInteraction } from "../RenaissHub/SurfProBoosterInteraction";
import { RenaissRewardCard } from "./RenaissRewardCard";
import type { RosterWinner } from "./types";
import "../RenaissHub/SurfDrawBatchScene.css";
import { useDrawViewportStage } from "../DrawRoom/useDrawViewportStage";

export function RenaissPackDraw({
  locale,
  onDraw,
  onActive,
  onDone,
  replay,
  disabledReason,
  revision,
  visible,
}: {
  locale: AppLocale;
  revision: number;
  visible: boolean;
  onDraw: () => Promise<RosterWinner>;
  onActive: (active: boolean) => void;
  onDone: () => void;
  replay?: RosterWinner;
  disabledReason?: string;
}) {
  const root = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    opening = useRef(false);
  useDrawViewportStage(root);
  const [phase, setPhase] = useState<RevealPhase>("settling"),
    [winner, setWinner] = useState<RosterWinner | null>(replay ?? null),
    [waiting, setWaiting] = useState(false);
  const assets = useSurfDrawMotionAssets();
  const flight = useSurfBatchFlight({
    root,
    canvas,
    phase,
    revision,
    active: visible,
    kind: "surf-pro-month",
    duration: "RENAISS SPECIAL",
    brand: "renaiss",
    progress: { current: winner ? 1 : 0, total: 1 },
    images: assets.images,
    logos: assets.logos,
    onSettled: () => setPhase("identity"),
    onRevealed: () => {
      setPhase("revealed");
      onActive(false);
    },
  });
  useEffect(() => () => onActive(false), [onActive]);
  useLayoutEffect(() => {
    opening.current = false; setPhase('settling'); setWinner(replay ?? null); setWaiting(false);
  }, [revision, replay]);
  function bringStageIntoView() {
    const rect = root.current?.getBoundingClientRect();
    if (rect && (rect.top < 0 || rect.bottom > window.innerHeight)) {
      root.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }
  async function open() {
    if (opening.current || !flight.ready || (!replay && disabledReason)) return false;
    bringStageIntoView();
    opening.current = true;
    setWaiting(true);
    onActive(true);
    try {
      const result = winner ?? (await onDraw());
      setWinner(result);
      return await new Promise<boolean>(resolve => requestAnimationFrame(() => {
        const opened = flight.openPack();
        setWaiting(false);
        if (!opened) { opening.current = false; onActive(false); }
        resolve(opened);
      }));
    } catch {
      opening.current = false;
      setWaiting(false);
      onActive(false);
      return false;
    }
  }
  const ready = flight.ready && assets.card.ready;
  return (
    <div
      ref={root}
      className="surf-batch-scene roster-pack-scene"
      data-kind="surf-pro-month"
      data-brand="renaiss"
      data-count="1"
      data-phase={phase}
      data-prepared={ready}
      data-replay={Boolean(replay)}
    >
      <div className="surf-batch-heading">
        <span>
          RENAISS COLLECTION <i />
          {replay?.requestId === "demo"
            ? "DEMO · 示範資料"
            : replay
              ? "REPLAY"
              : "ONE PACK · ONE WINNER"}
        </span>
        <h2>{phase === "revealed" ? "本次得獎者" : phase === "identity" ? "翻開得獎卡" : "選擇卡包"}
          {replay ? <small>{replay.requestId === "demo" ? "Demo" : "重播"}</small> : null}
        </h2>
        {phase === "revealed" ? <p>{winner?.prize}</p> : null}
      </div>
      <canvas ref={canvas} className="surf-batch-webgl" aria-hidden="true" />
      <div className="surf-batch-flash" aria-hidden="true" />
      {phase === "settling" && !flight.packOpened && ready ? (
        <div inert={waiting}>
          <SurfProBoosterInteraction
            key={revision}
            locale={locale}
            onSpin={flight.spinPacks}
            onBrowse={flight.browsePacks}
            brand="renaiss"
            disabledReason={replay ? undefined : disabledReason}
            onOpen={open}
            onPreview={flight.previewPack}
            onRelease={flight.releasePack}
            onSelect={flight.selectPack}
            onRotate={flight.rotatePack}
            onFocus={focused => {
              if (focused) bringStageIntoView();
              flight.focusPack(focused);
            }}
          />
        </div>
      ) : null}
      {!ready ? (
        <div
          className="surf-batch-loading"
          role={flight.error || assets.card.error ? "alert" : "status"}
        >
          {flight.error || assets.card.error
            ? "卡包素材準備失敗，請重新載入。"
            : "正在準備 Renaiss 卡包…"}
        </div>
      ) : null}
      {waiting ? (
        <div className="roster-pack-status" role="status">
          正在確認抽獎結果…
        </div>
      ) : null}
      <ol
        className="surf-batch-gallery"
        aria-label="得獎者卡片"
        aria-hidden={phase !== "identity" && phase !== "revealed"}
      >
        <RenaissRewardCard
          winner={winner}
          shown={phase === "revealed"}
          turning={flight.flipping === 0}
          revealable={phase === "identity"}
          onFlip={() => flight.flipCard(0)}
        />
      </ol>
      {phase === "revealed" ? (
        <button
          type="button"
          className="roster-primary roster-pack-next"
          onClick={onDone}
        >
          {replay ? "返回抽獎" : "準備下一張"} ↗
        </button>
      ) : null}
    </div>
  );
}
