import { useState, type ReactNode } from "react";
import type { BinderPage } from "../../../shared/member-binder.js";
import { BINDER_LAYOUTS } from "../../../shared/member-binder.js";
import { isPortraitCard, type BinderCollectible } from "./binderCollectible";
import { BinderCollectibleArt } from "./BinderCollectibleArt";
import { BinderPocketShine } from "./BinderPocketShine";
import { pocketKey } from "./useBinderPocketMotion";
import { useBinderPocketInsertions } from "./useBinderPocketInsertions";
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
  writing,
  leaving,
}: {
  page: BinderPage;
  number: number;
  side: "front" | "back";
  visible: boolean;
  library: Map<string, BinderCollectible>;
  copy: BinderCopy;
  disabled: boolean;
  picking: number | null;
  onPocket: (index: number) => void;
  onDetail: (index: number) => void;
  onLayout: (size: 1 | 6 | 9) => void;
  onRemove?: () => void;
  onMove: (from: PocketTarget, index: number) => void;
  onEmpty: (index: number) => void;
  writing: ReactNode;
  leaving: ReadonlySet<string>;
}) {
  const [failed, setFailed] = useState(new Set<string>());
  const [over, setOver] = useState<number | null>(null);
  const added = useBinderPocketInsertions(page.slots);
  const pagePending = page.slots.some((_, pocket) => leaving.has(pocketKey({ page: page.id, pocket })));
  return (
    <article
      className={`face face--frost face--${side}`}
      aria-label={copy.page + " " + number}
      inert={!visible}
    >
      <div className={`grid grid--${page.size}`}>
        {page.slots.map((token, index) => {
          const badge = token === null ? undefined : library.get(token);
          const lifting = leaving.has(pocketKey({ page: page.id, pocket: index }));
          return (
            <div
              key={index}
              className={`slot ${badge ? `filled ${isPortraitCard(badge) ? "slot--card" : "slot--sbt"}` : ""} ${picking === index ? "pick-target" : ""} ${over === index ? "drag" : ""}`}
              draggable={Boolean(badge) && !disabled && !lifting}
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
                  !lifting &&
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
                if (disabled || lifting) return;
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
                disabled={disabled || lifting}
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
                    <BinderCollectibleArt
                      key={token}
                      item={badge}
                      loading={visible ? "eager" : "lazy"}
                      className={`${isPortraitCard(badge) ? "slot-crop" : ""} ${lifting ? "bnd-card-lift" : added.has(index) ? "bnd-card-drop" : ""}`}
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
              {badge && added.has(index) && !lifting ? <BinderPocketShine key={badge.tokenId} /> : null}
              {token && !lifting ? (
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
            disabled={disabled || pagePending}
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
            disabled={disabled || pagePending}
          >
            ✕ {copy.pageWord}
          </button>
        ) : null}
      </div>
      {writing}
      <div className="shade" />
    </article>
  );
}
