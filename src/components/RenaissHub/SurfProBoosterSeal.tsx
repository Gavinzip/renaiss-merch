import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { AppLocale } from "../../i18n/LocaleContext";

import { PRO_TEAR_FINISH_AT as FINISH_TEAR_AT } from './draw-effects/batch-ceremony/proBoosterTimeline';

// The same progress drives the tear mesh and the handle. Releasing a partial
// tear leaves it in place; at 90% the foil timeline completes the last segment.
export function SurfProBoosterSeal({
  locale,
  onPreview,
  onOpen,
  disabled = false,
}: {
  locale: AppLocale;
  onPreview: (progress: number) => void;
  onOpen: () => boolean | void | Promise<boolean | void>;
  disabled?: boolean;
}) {
  const [progress, setProgress] = useState(0),
    [pending, setPending] = useState(false);
  const value = useRef(0),
    completing = useRef(false);
  const drag = useRef<{
    id: number;
    x: number;
    progress: number;
    remainingTravel: number;
  } | null>(null);
  const zh = locale === "zh-TW",
    ko = locale === "ko";
  const label = zh
    ? "向右拖曳，撕開封口"
    : ko
      ? "오른쪽으로 드래그하여 뜯기"
      : "Drag right to tear the seal";
  function update(next: number) {
    value.current = Math.max(
      0,
      Math.min(FINISH_TEAR_AT, Math.round(next * 1000) / 1000),
    );
    setProgress(value.current);
    onPreview(value.current);
  }
  async function finish() {
    if (disabled || value.current < FINISH_TEAR_AT || completing.current)
      return;
    completing.current = true;
    setPending(true);
    try {
      if ((await onOpen()) !== false) return;
    } catch {
      /* The owning draw flow displays its request error. */
    }
    completing.current = false;
    setPending(false);
    update(0.84);
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0 || completing.current || drag.current)
      return;
    const rect = event.currentTarget.getBoundingClientRect();
    const start = rect.left + 12,
      end = rect.right - 12;
    // Grab the torn edge, not an arbitrary point further along the seal.
    if (Math.abs(event.clientX - (start + value.current * (end - start))) > 28)
      return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      progress: value.current,
      remainingTravel: Math.max(1, end - event.clientX),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const held = drag.current;
    if (disabled || completing.current || !held || event.pointerId !== held.id)
      return;
    const distance = Math.max(0, event.clientX - held.x);
    if (!distance) return;
    update(
      Math.max(
        value.current,
        held.progress + (distance / held.remainingTravel) * (1 - held.progress),
      ),
    );
    void finish();
  }
  function up(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== drag.current?.id) return;
    move(event);
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    void finish();
  }
  return (
    <div
      className="surf-pro-booster-seal"
      role="slider"
      tabIndex={pending || disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.floor(progress * 100)}
      aria-valuetext={`${Math.floor(progress * 100)}%`}
      aria-disabled={pending || disabled}
      aria-orientation="horizontal"
      style={{ "--tear-progress": progress } as CSSProperties}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onKeyDown={(event) => {
        if (
          disabled ||
          pending ||
          !["ArrowRight", "ArrowUp", "End"].includes(event.key)
        )
          return;
        event.preventDefault();
        update(event.key === "End" ? FINISH_TEAR_AT : value.current + 0.1);
        void finish();
      }}
    >
      <span className="surf-pro-booster-seal__guide" aria-hidden="true" />
      <span className="surf-pro-booster-seal__grip" aria-hidden="true">
        →
      </span>
      <span className="surf-pro-booster-seal__label" aria-hidden="true">
        {pending ? (zh ? "正在揭曉…" : "Opening…") : label}
      </span>
    </div>
  );
}
