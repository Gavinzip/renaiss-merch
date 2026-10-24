import { useEffect, useRef, useState } from "react";
import type { BinderPage } from "../../../shared/member-binder.js";
import { BINDER_LAYOUTS } from "../../../shared/member-binder.js";
import type { BinderBadge } from "./binderApi";
import type { BinderCopy } from "./binderCopy";
import type { PocketTarget } from "./BinderBook";

export function BinderSheet({
  page,
  number,
  side,
  visible,
  library,
  copy,
  disabled,
  picking,
  onPocket,
  onDetail,
  onLayout,
  onRemove,
  onMove,
  onEmpty,
}: {
  page: BinderPage;
  number: number;
  side: "front" | "back";
  visible: boolean;
  library: Map<string, BinderBadge>;
  copy: BinderCopy;
  disabled: boolean;
  picking: number | null;
  onPocket: (index: number) => void;
  onDetail: (index: number) => void;
  onLayout: (size: 1 | 6 | 9) => void;
  onRemove?: () => void;
  onMove: (from: PocketTarget, index: number) => void;
  onEmpty: (index: number) => void;
}) {
  const [failed, setFailed] = useState(new Set<string>());
  const [over, setOver] = useState<number | null>(null),
    [added, setAdded] = useState<number[]>([]);
  const previous = useRef(page.slots);
  useEffect(() => {
    const changed = page.slots.flatMap((token, i) =>
      token && token !== previous.current[i] ? [i] : [],
    );
    previous.current = page.slots;
    setAdded(changed);
    const timer = setTimeout(() => setAdded([]), 600);
    return () => clearTimeout(timer);
  }, [page.slots]);
  return (
    <article
      className={`face face--frost face--${side}`}
      aria-label={copy.page + " " + number}
      inert={!visible}
    >
      <div className={`grid grid--${page.size}`}>
        {page.slots.map((token, index) => {
          const badge = token === null ? undefined : library.get(token);
          return (
            <div
              key={index}
              className={`slot ${badge ? "filled slot--sbt" : ""} ${picking === index ? "pick-target" : ""} ${over === index ? "drag" : ""}`}
              draggable={Boolean(badge) && !disabled}
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  "application/x-merch-binder-slot",
                  JSON.stringify({ page: page.id, pocket: index }),
                );
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => {
                if (
                  !disabled &&
                  event.dataTransfer.types.includes(
                    "application/x-merch-binder-slot",
                  )
                ) {
                  event.preventDefault();
                  setOver(index);
                }
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(event) => {
                setOver(null);
                if (disabled) return;
                event.preventDefault();
                try {
                  const from = JSON.parse(
                    event.dataTransfer.getData(
                      "application/x-merch-binder-slot",
                    ),
                  );
                  if (
                    typeof from.page === "string" &&
                    Number.isInteger(from.pocket)
                  )
                    onMove(from, index);
                } catch {
                  /* Ignore unrelated drag data. */
                }
              }}
            >
              <button
                type="button"
                className="slot-hit"
                disabled={disabled}
                aria-label={
                  badge
                    ? badge.name
                    : token
                      ? copy.unavailable
                      : copy.choose + " " + (index + 1)
                }
                onClick={() => (badge ? onDetail(index) : onPocket(index))}
              >
                {badge ? (
                  <>
                    <img
                      key={token}
                      src={badge.imageUrl}
                      alt={badge.name}
                      draggable={false}
                      className={added.includes(index) ? "bnd-card-drop" : ""}
                      width="240"
                      height="240"
                      onError={() =>
                        setFailed((value) => new Set(value).add(badge.tokenId))
                      }
                    />
                    {failed.has(badge.tokenId) ? (
                      <span role="alert">{copy.error}</span>
                    ) : null}
                  </>
                ) : token ? (
                  <span className="slot-unavailable">
                    {copy.unavailable}
                    <small>{copy.unavailableBody}</small>
                  </span>
                ) : null}
              </button>
              {token ? (
                <button
                  type="button"
                  className="slot-x"
                  disabled={disabled}
                  aria-label={`${copy.remove}: ${badge?.name || copy.unavailable}`}
                  onClick={() => onEmpty(index)}
                >
                  ×
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <span className="page-num">{String(number).padStart(2, "0")}</span>
      <div
        className="layout-ctl"
        role="group"
        aria-label={`${copy.pocket} ${number}`}
      >
        {BINDER_LAYOUTS.map((size) => (
          <button
            type="button"
            className={page.size === size ? "on" : ""}
            key={size}
            aria-label={size + " " + copy.pocket}
            aria-pressed={page.size === size}
            disabled={disabled}
            onClick={() => onLayout(size)}
          >
            {size}
            <span className="layout-thumb" aria-hidden="true">
              <span className={`layout-thumb-grid tg--${size}`}>
                {Array.from({ length: size }, (_, i) => (
                  <i key={i} />
                ))}
              </span>
              <span className="layout-thumb-cap">
                {size} {copy.pocket}
              </span>
            </span>
          </button>
        ))}
        {onRemove ? (
          <button
            className="page-del"
            type="button"
            aria-label={`${copy.removePage} ${number}`}
            onClick={onRemove}
            disabled={disabled}
          >
            ✕ {copy.pageWord}
          </button>
        ) : null}
      </div>
      <div className="shade" />
    </article>
  );
}
