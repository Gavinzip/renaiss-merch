import { useLayoutEffect, useRef, type CSSProperties } from "react";
import type {
  MemberBinder,
  BinderPage,
} from "../../../shared/member-binder.js";
import type { BinderBadge } from "./binderApi";
import type { BinderCopy } from "./binderCopy";
import type { RenaissUser } from "../../lib/renaissAuth";
import { BinderWordmark } from "./BinderWordmark";
import { BinderSheet } from "./BinderSheet";
import { BinderTitle } from "./BinderTitle";
import { useBinderBook } from "./useBinderBook";
import { leafOrder } from "./binderMotion";
import "./BinderBook.css";

export type PocketTarget = { page: string; pocket: number };
export function BinderBook({
  binder,
  badges,
  user,
  copy,
  disabled,
  picking,
  practice = false,
  onPocket,
  onDetail,
  onLayout,
  onRemove,
  onAdd,
  onMove,
  onEmpty,
}: {
  binder: MemberBinder;
  badges: BinderBadge[];
  user: RenaissUser;
  copy: BinderCopy;
  disabled: boolean;
  picking: PocketTarget | null;
  practice?: boolean;
  onPocket: (target: PocketTarget) => void;
  onDetail: (target: PocketTarget) => void;
  onLayout: (id: string, size: 1 | 6 | 9) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onMove: (from: PocketTarget, to: PocketTarget) => void;
  onEmpty: (target: PocketTarget) => void;
}) {
  const motion = useBinderBook(binder.pages.length, Boolean(picking));
  const { spread, wide, subPage, leafCount } = motion;
  const stage = useRef<HTMLDivElement>(null);
  const library = new Map(badges.map((b) => [b.tokenId, b]));
  const placed = binder.pages.reduce(
    (sum, p) => sum + p.slots.filter(Boolean).length,
    0,
  );
  const name = user.name || "Renaiss";
  const previousCount = useRef(binder.pages.length);
  useLayoutEffect(() => {
    if (binder.pages.length > previousCount.current)
      motion.go(Math.floor(previousCount.current / 2) + 1);
    previousCount.current = binder.pages.length;
  }, [binder.pages.length, motion]);
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const size = () => {
      const width = el.clientWidth,
        height = el.clientHeight;
      const fill = !wide || (window.innerWidth <= 1100 && window.innerHeight <= 820);
      el.dataset.fit = fill ? "fill" : "proportional";
      const pw = fill
        ? (width - 16) / (wide ? 2 : 1)
        : Math.min((width - 48) / 2, ((height - 22) * 5) / 7, 620);
      const ph = fill ? height - 8 : (pw * 7) / 5;
      el.style.setProperty("--pw", `${Math.max(80, pw)}px`);
      el.style.setProperty("--ph", `${Math.max(112, ph)}px`);
    };
    const observer = new ResizeObserver(size);
    observer.observe(el);
    size();
    return () => observer.disconnect();
  }, [wide]);
  const inside = (side: "front" | "back", visible: boolean) => (
    <div className={`face face--inside face--${side}`} inert={!visible}>
      <span className="inside-mark">◈</span>
      <div className="shade" />
    </div>
  );
  function pageFace(index: number, side: "front" | "back", visible: boolean) {
    const page: BinderPage | undefined = binder.pages[index];
    if (page)
      return (
        <BinderSheet
          page={page}
          number={index + 1}
          side={side}
          visible={visible}
          library={library}
          copy={copy}
          disabled={disabled}
          picking={picking?.page === page.id ? picking.pocket : null}
          onPocket={(pocket) => onPocket({ page: page.id, pocket })}
          onDetail={(pocket) => onDetail({ page: page.id, pocket })}
          onLayout={(size) => onLayout(page.id, size)}
          onRemove={
            binder.pages.length > 1 ? () => onRemove(page.id) : undefined
          }
          onMove={(from, pocket) => onMove(from, { page: page.id, pocket })}
          onEmpty={(pocket) => onEmpty({ page: page.id, pocket })}
        />
      );
    if (index === binder.pages.length)
      return (
        <div
          className={`face face--frost face--addpage face--${side}`}
          inert={!visible}
        >
          <button
            type="button"
            className="addpage-btn"
            disabled={disabled || binder.pages.length >= 24}
            onClick={onAdd}
          >
            <span>+</span>
            {copy.addPage}
          </button>
          <div className="shade" />
        </div>
      );
    return inside(side, visible);
  }
  const first = 2 * spread - 3;
  const shown = (wide ? [first, first + 1] : [first + subPage])
    .filter((i) => i >= 0 && i < binder.pages.length)
    .map((i) => String(i + 1).padStart(2, "0"));
  const title =
    spread === 0
      ? copy.front
      : spread === leafCount
        ? copy.backCover
        : shown.length
          ? `${copy.page} ${shown.join("–")} / ${String(binder.pages.length).padStart(2, "0")}`
          : copy.addPage;
  return (
    <>
      <section className="stage" ref={stage} aria-label={copy.title}>
        <BinderTitle name={name} />
        <div
          ref={motion.bookRef}
          className={`book ${spread === 0 ? "at-front idle" : spread === leafCount ? "at-back" : "open"} ${!wide && spread > 0 && spread < leafCount ? "mob-shift" : ""}`}
          style={
            {
              "--mob-shift":
                subPage === 0 ? "calc(var(--pw) / 2)" : "calc(var(--pw) / -2)",
            } as CSSProperties
          }
          onMouseMove={motion.onMouseMove}
          onMouseLeave={motion.onMouseLeave}
        >
          <div className="glow" aria-hidden="true" />
          <div className="rings" aria-hidden="true">
            <span className="ring" />
            <span className="ring" />
            <span className="ring" />
          </div>
          {Array.from({ length: leafCount }, (_, index) => {
            const front =
              index === spread && (wide || subPage === 1 || spread === 0);
            const back =
              index === spread - 1 &&
              (wide || subPage === 0 || spread === leafCount);
            return (
              <div
                key={index}
                ref={(el) => {
                  if (el) motion.leaves.current.set(index, el);
                  else motion.leaves.current.delete(index);
                }}
                className={`leaf ${index === 0 ? "leaf--cover-front" : index < leafCount - 1 ? `leaf--page leaf--p${index}` : ""} ${index < spread ? "flipped" : ""} ${front || back ? "leaf--active" : ""}`}
                style={{ zIndex: leafOrder(index, spread, leafCount) }}
              >
                {index === 0 ? (
                  <>
                    <div
                      className="face face--cover face--profile face--front"
                      inert={!front}
                    >
                      <div className="cov-bg">
                        {user.picture ? (
                          <img src={user.picture} alt="" />
                        ) : null}
                      </div>
                      <div className="cov-noise" />
                      <button
                        type="button"
                        className="cov"
                        aria-label={copy.openCover}
                        onClick={() => motion.step(1)}
                      >
                        <span className="cov-avatar">
                          {user.picture ? (
                            <img src={user.picture} alt="" />
                          ) : (
                            name.charAt(0)
                          )}
                        </span>
                        <span className="cov-name">{name}</span>
                        <span className="cov-badges">
                          {badges.slice(0, 4).map((b) => (
                            <span
                              key={b.tokenId}
                              className="cov-badge cov-badge--img"
                            >
                              <img src={b.imageUrl} alt={b.name} />
                            </span>
                          ))}
                          {badges.length > 4 ? (
                            <span className="cov-badge cov-badge--more">
                              +{badges.length - 4}
                            </span>
                          ) : null}
                        </span>
                        <span className="cov-line" />
                        <span className="cov-stats">
                          <span>
                            <b>{placed}</b>
                            <span>{copy.totalCollectibles}</span>
                          </span>
                          <span>
                            <b>$—</b>
                            <span>{copy.highestValue}</span>
                          </span>
                          <span>
                            <b>$—</b>
                            <span>{copy.totalValue}</span>
                          </span>
                        </span>
                      </button>
                      <div className="shade" />
                    </div>
                    {inside("back", back)}
                  </>
                ) : index === leafCount - 1 ? (
                  <>
                    {inside("front", front)}
                    <div className="face face--cover face--back" inert={!back}>
                      <div className="cov-noise" />
                      <button
                        className="back-brand"
                        type="button"
                        onClick={() => motion.step(-1)}
                        aria-label={copy.openCover}
                      >
                        <BinderWordmark />
                        <span className="back-sub">{name}'s Binder</span>
                      </button>
                      <div className="shade" />
                    </div>
                  </>
                ) : (
                  <>
                    {pageFace((index - 1) * 2, "front", front)}
                    {pageFace((index - 1) * 2 + 1, "back", back)}
                  </>
                )}
              </div>
            );
          })}
          <div
            className="edge edge--l"
            aria-hidden="true"
            hidden={spread === 0 || (!wide && subPage !== 0)}
            {...motion.pointerProps("left")}
          />
          <div
            className="edge edge--r"
            aria-hidden="true"
            hidden={spread === leafCount || (!wide && subPage !== 1)}
            {...motion.pointerProps("right")}
          />
        </div>
      </section>
      <footer className="controls">
        <button
          className="nav"
          type="button"
          aria-label={copy.previous}
          disabled={spread === 0}
          onClick={() => motion.step(-1)}
        >
          ‹
        </button>
        <div className="pager">
          <nav className="dots" aria-label={copy.title}>
            {Array.from({ length: leafCount + 1 }, (_, index) => {
              const left = 2 * index - 3;
              const label =
                index === 0
                  ? copy.front
                  : index === leafCount
                    ? copy.backCover
                    : `${copy.page} ${
                        [left, left + 1]
                          .filter((i) => i >= 0 && i < binder.pages.length)
                          .map((i) => String(i + 1).padStart(2, "0"))
                          .join("–") || copy.end
                      }`;
              return (
                <button
                  key={index}
                  className={`dot ${index === spread ? "on" : ""}`}
                  type="button"
                  aria-label={label}
                  title={label}
                  aria-current={index === spread ? "page" : undefined}
                  onClick={() => motion.go(index)}
                />
              );
            })}
          </nav>
          <span className="binder-readout" aria-live="polite">
            {practice ? `${copy.practice} · ` : ""}{title}
          </span>
        </div>
        <button
          className="nav"
          type="button"
          aria-label={copy.next}
          disabled={spread === leafCount}
          onClick={() => motion.step(1)}
        >
          ›
        </button>
      </footer>
    </>
  );
}
