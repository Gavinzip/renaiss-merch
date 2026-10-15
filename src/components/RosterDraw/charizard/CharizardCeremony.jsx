import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BonusPrizeReveal } from "./BonusPrizeReveal.jsx";
import {
  createFinaleSoundtrack,
  prepareFinaleAudio,
  unlockFinaleAudio,
  SCORE_OFFSET,
} from "./finaleSoundtrack.js";
import { rosterDrawAsset } from "../rosterDrawAssets";
import { useCharizardEntrance } from "./useCharizardEntrance.js";
import "./finale.css";

export default function CharizardCeremony({
  onDraw,
  onClose,
  onActive,
  replay,
  origin,
  onReady,
  onPreparationError,
}) {
  const dialog = useRef(null),
    sound = useRef(null),
    lock = useRef(false);
  const [sceneReady, setSceneReady] = useState(false),
    [audioReady, setAudioReady] = useState(false),
    [error, setError] = useState("");
  const [winner, setWinner] = useState(replay ?? null),
    [playing, setPlaying] = useState(false),
    [complete, setComplete] = useState(false),
    [waiting, setWaiting] = useState(false),
    [muted, setMuted] = useState(false);
  const [drawError, setDrawError] = useState("");
  const [runId, setRunId] = useState(0);
  const ready = sceneReady && audioReady && !error;
  const latestReady = useRef(ready);
  latestReady.current = ready;
  const entered = useCharizardEntrance(dialog, origin, ready || Boolean(error));
  useEffect(() => {
    let live = true;
    const score = createFinaleSoundtrack(() => {});
    sound.current = score;
    prepareFinaleAudio()
      .then((buffer) => {
        if (live) {
          score.attach(buffer);
          setAudioReady(true);
        }
      })
      .catch(() => {
        if (live) setError("配樂載入失敗，請重新載入頁面。");
      });
    return () => {
      live = false;
      score.dispose();
    };
  }, []);
  useEffect(() => {
    onPreparationError(error);
    if (error) { sound.current?.setPlaying(false); setPlaying(false); lock.current = false; }
  }, [error, onPreparationError]);
  useEffect(() => { onReady(ready); }, [ready, onReady]);
  useEffect(() => {
    onActive(Boolean(origin));
    if (origin) {
      lock.current = false;
      setWinner(replay ?? null); setPlaying(false); setComplete(false);
      setWaiting(false); setDrawError(''); setRunId(value => value + 1);
      sound.current?.seek(1 + SCORE_OFFSET, false);
    } else {
      setPlaying(false);
      sound.current?.setPlaying(false);
    }
    return () => onActive(false);
  }, [origin, replay, onActive]);
  useEffect(() => {
    if (!playing) return;
    const sync = () => sound.current?.setPlaying(!document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [playing]);
  const readTime = useCallback(
    () =>
      Math.max(0, (sound.current?.time() ?? 1 + SCORE_OFFSET) - SCORE_OFFSET),
    [],
  );
  async function start() {
    if (lock.current || !ready || !entered) return;
    unlockFinaleAudio();
    lock.current = true;
    setWaiting(true);
    try {
      const next = winner ?? (await onDraw());
      setWinner(next);
      if (!latestReady.current) { setWaiting(false); lock.current = false; return; }
      sound.current.seek(1 + SCORE_OFFSET, true);
      setPlaying(true);
      setWaiting(false);
    } catch (reason) {
      lock.current = false;
      setWaiting(false);
      setDrawError(
        reason instanceof Error
          ? reason.message
          : "連線中斷，請重試同一次抽獎。",
      );
    }
  }
  return createPortal(
    <dialog
      ref={dialog}
      className="bonus-finale-dialog roster-charizard-dialog"
      data-entrance={entered ? "entered" : "expanding"}
      aria-label="噴火龍開獎"
      onCancel={(event) => {
        event.preventDefault();
        if (!waiting && (!playing || complete)) onClose();
      }}
    >
      <header className="bonus-finale-header">
        <span>
          RENAISS <i /> CHARIZARD
        </span>
        <span>
          {replay?.requestId === "demo"
            ? "DEMO · 示範資料"
            : replay
              ? "重播已保存結果"
              : ""}
        </span>
        <button
          type="button"
          aria-label={muted ? "開啟配樂" : "靜音"}
          onClick={() => {
            sound.current?.setVolume(0.7, !muted);
            setMuted(!muted);
          }}
        >
          {muted ? "♪̸" : "♪"}
        </button>
        <button
          type="button"
          aria-label="關閉噴火龍舞台"
          disabled={waiting || (playing && !complete)}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <BonusPrizeReveal
        active={Boolean(origin)}
        winner={
          winner
            ? { displayName: winner.name }
            : null
        }
        textureUrl={rosterDrawAsset("box")}
        cardTextureUrl={rosterDrawAsset("card")}
        playing={playing}
        initialTime={1}
        runId={runId}
        view="reveal"
        readPlaybackTime={readTime}
        cinematic
        onReady={() => setSceneReady(true)}
        onError={() => setError("噴火龍場景載入失敗，請重新載入頁面。")}
        onComplete={() => {
          setComplete(true);
          sound.current?.setPlaying(false);
        }}
      />
      {!playing ? (
        <div className="roster-charizard-start">
          {error || drawError ? <p role="alert">{error || drawError}</p> : null}
          <button
            type="button"
            disabled={waiting || (!error && (!ready || !entered))}
            onClick={() => error ? window.location.reload() : void start()}
          >
            {error ? "重新載入頁面" : waiting
              ? "保存中…"
              : drawError
                ? "重試同一次抽獎"
                : replay
                  ? replay.requestId === "demo" ? "播放 Demo" : "重播這次開獎"
                  : "Reveal"}{" "}
            ↗
          </button>
        </div>
      ) : null}
      {complete ? (
        <button
          type="button"
          className="roster-charizard-return"
          onClick={onClose}
        >
          返回開獎室 ↗
        </button>
      ) : null}
    </dialog>,
    document.body,
  );
}
