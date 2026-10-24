import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BINDER_STROKE_POINTS,
  type BinderMark,
  type BinderStroke,
  type InkPoint,
} from "../../../shared/binder-writing.js";
import type { BinderWritingController } from "./useBinderWriting";
import type { BinderWritingCopy } from "./binderWritingCopy";
import { layoutBinderText } from "./binderTextLayout";

// Quadratic midpoints keep fast finger strokes smooth without raster snapshots.
function strokePath(points: InkPoint[]) {
  const [first, ...rest] = points;
  if (!rest.length) return `M${first[0]} ${first[1]}l.01 .01`;
  let path = `M${first[0]} ${first[1]}`;
  for (let i = 0; i < rest.length - 1; i++) {
    const a = rest[i],
      b = rest[i + 1];
    path += `Q${a[0]} ${a[1]} ${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2}`;
  }
  const end = rest[rest.length - 1];
  return path + `L${end[0]} ${end[1]}`;
}
function InkMark({ mark, aspect }: { mark: BinderMark; aspect: number }) {
  const layout = useMemo(
    () => (mark.kind === "text" ? layoutBinderText(mark, aspect) : null),
    [mark, aspect],
  );
  if (mark.kind === "stroke")
    return (
      <path
        data-ink-mark={mark.id}
        d={strokePath(mark.points)}
        fill="none"
        stroke={mark.color}
        strokeWidth={mark.width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  return (
    <text
      data-ink-mark={mark.id}
      fill={mark.color}
      fontSize={layout!.size}
      transform={`translate(${layout!.x} ${layout!.y}) scale(1 ${aspect})`}
      dominantBaseline="hanging"
    >
      {layout!.lines.map((line, i) => (
        <tspan key={i} x={0} dy={i ? "1.3em" : 0}>
          {line || " "}
        </tspan>
      ))}
    </text>
  );
}

export function BinderWritingLayer({
  surface,
  visible,
  ink,
  copy,
}: {
  surface: string;
  visible: boolean;
  ink: BinderWritingController;
  copy: BinderWritingCopy;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const gesture = useRef<{
    pointer: number;
    strokes: BinderStroke[];
    remaining: number;
    remainingMarks: number;
    exhausted: boolean;
    erased: Set<string>;
  } | null>(null);
  const [draft, setDraft] = useState<BinderStroke[]>([]);
  const [erased, setErased] = useState(new Set<string>());
  const [textAt, setTextAt] = useState<InkPoint | null>(null);
  const [text, setText] = useState("");
  const [aspect, setAspect] = useState(1);
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const resize = new ResizeObserver(() =>
      setAspect(el.clientWidth / Math.max(1, el.clientHeight)),
    );
    resize.observe(el);
    return () => resize.disconnect();
  }, []);
  const marks = ink.writing[surface] || [];
  const active = visible && ink.tool !== "read";
  useEffect(() => {
    if (!visible) {
      gesture.current = null;
      setDraft([]);
      setErased(new Set());
      setTextAt(null);
      setText("");
      // Only this surface may release its own gesture/composer lock.
    }
  }, [visible]);
  const ownsBusy = useRef(false);
  useEffect(
    () => () => {
      if (ownsBusy.current) ink.setBusy(false);
    },
    [ink.setBusy],
  );
  useEffect(() => {
    if (!visible && ownsBusy.current) {
      ownsBusy.current = false;
      ink.setBusy(false);
    }
  }, [visible, ink.setBusy]);
  function lock(value: boolean) {
    ownsBusy.current = value;
    ink.setBusy(value);
  }
  function point(event: { clientX: number; clientY: number }): InkPoint {
    const rect = svg.current!.getBoundingClientRect();
    return [
      Math.round(
        Math.max(
          0,
          Math.min(1000, ((event.clientX - rect.left) * 1000) / rect.width),
        ),
      ),
      Math.round(
        Math.max(
          0,
          Math.min(1000, ((event.clientY - rect.top) * 1000) / rect.height),
        ),
      ),
    ];
  }
  function eraseAt(event: { clientX: number; clientY: number }) {
    const hit = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest("[data-ink-mark]")
      ?.getAttribute("data-ink-mark");
    if (hit && gesture.current) {
      gesture.current.erased.add(hit);
      setErased(new Set(gesture.current.erased));
    }
  }
  function finish(event: ReactPointerEvent<SVGSVGElement>, cancelled = false) {
    const g = gesture.current;
    if (!g || g.pointer !== event.pointerId) return;
    gesture.current = null;
    if (!cancelled) {
      if (g.strokes.length) ink.update(surface, [...marks, ...g.strokes]);
      else if (g.erased.size)
        ink.update(
          surface,
          marks.filter((mark) => !g.erased.has(mark.id)),
        );
      if (g.exhausted) ink.setLimit(true);
    }
    setDraft([]);
    setErased(new Set());
    lock(false);
  }
  return (
    <div
      className={`binder-ink-layer ${active ? "is-writing" : ""}`}
      data-surface={surface}
      data-tool={ink.tool}
    >
      <svg
        ref={svg}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        role="img"
        aria-label={copy.surface}
        onPointerDown={(event) => {
          if (!active || !event.isPrimary || event.button !== 0 || textAt)
            return;
          event.preventDefault();
          event.stopPropagation();
          if (
            ink.tool !== "erase" &&
            (ink.remainingMarks < 1 ||
              (ink.tool === "pen" && ink.remainingPoints < 1))
          ) {
            ink.setLimit(true);
            return;
          }
          if (ink.tool === "text") {
            setTextAt(point(event));
            lock(true);
            return;
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          const stroke: BinderStroke | null =
            ink.tool === "pen"
              ? {
                  id: crypto.randomUUID(),
                  kind: "stroke",
                  color: ink.color,
                  width: ([3, 6, 10] as const)[ink.size],
                  points: [point(event)],
                }
              : null;
          gesture.current = {
            pointer: event.pointerId,
            strokes: stroke ? [stroke] : [],
            remaining: ink.remainingPoints - (stroke ? 1 : 0),
            remainingMarks: ink.remainingMarks - (stroke ? 1 : 0),
            exhausted: false,
            erased: new Set(),
          };
          lock(true);
          setDraft(stroke ? [stroke] : []);
          if (ink.tool === "erase") eraseAt(event);
        }}
        onPointerMove={(event) => {
          const g = gesture.current;
          if (!g || g.pointer !== event.pointerId) return;
          if (!g.strokes.length) {
            eraseAt(event);
            return;
          }
          const stroke = g.strokes[g.strokes.length - 1];
          const p = point(event),
            previous = stroke.points[stroke.points.length - 1];
          if (Math.hypot(p[0] - previous[0], p[1] - previous[1]) < 2) return;
          if (
            g.remaining <= 0 ||
            (stroke.points.length >= BINDER_STROKE_POINTS &&
              (g.remaining < 2 || g.remainingMarks < 1))
          ) {
            g.exhausted = true;
            ink.setLimit(true);
            return;
          }
          if (stroke.points.length >= BINDER_STROKE_POINTS) {
            g.strokes.push({
              ...stroke,
              id: crypto.randomUUID(),
              points: [previous, p],
            });
            g.remaining -= 2;
            g.remainingMarks--;
          } else {
            stroke.points.push(p);
            g.remaining--;
          }
          setDraft(g.strokes.map((part) => ({ ...part })));
        }}
        onPointerUp={(event) => finish(event)}
        onPointerCancel={(event) => finish(event, true)}
        onLostPointerCapture={(event) => finish(event, true)}
      >
        {marks
          .filter((mark) => !erased.has(mark.id))
          .map((mark) => (
            <InkMark key={mark.id} mark={mark} aspect={aspect} />
          ))}
        {draft.map((mark) => (
          <InkMark key={mark.id} mark={mark} aspect={aspect} />
        ))}
      </svg>
      {textAt ? (
        <form
          className="binder-ink-composer"
          style={{
            left: `${Math.min(textAt[0] / 10, 45)}%`,
            top: `${Math.min(textAt[1] / 10, 70)}%`,
          }}
          onSubmit={(event) => {
            event.preventDefault();
            if (
              text.trim() &&
              !ink.update(surface, [
                ...marks,
                {
                  id: crypto.randomUUID(),
                  kind: "text",
                  color: ink.color,
                  size: ([24, 36, 52] as const)[ink.size],
                  x: textAt[0],
                  y: textAt[1],
                  text,
                },
              ])
            )
              return;
            setTextAt(null);
            setText("");
            lock(false);
          }}
        >
          <textarea
            autoFocus
            aria-label={copy.entry}
            placeholder={copy.entry}
            maxLength={240}
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setTextAt(null);
                setText("");
                lock(false);
              }
            }}
          />
          <div>
            <button
              type="button"
              onClick={() => {
                setTextAt(null);
                setText("");
                lock(false);
              }}
            >
              {copy.cancel}
            </button>
            <button type="submit" disabled={!text.trim()}>
              {copy.place}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
