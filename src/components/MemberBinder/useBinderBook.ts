import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type MouseEvent,
} from "react";
import { flushSync } from "react-dom";
import { bendLeaf, clearLeaf, leafOrder, TURN_MS } from "./binderMotion";

export function useBinderBook(
  pageCount: number,
  blocked: boolean,
) {
  const leafCount = Math.ceil((pageCount + 1) / 2) + 2;
  const [spread, setSpread] = useState(0);
  const [wide, setWide] = useState(
    () => matchMedia("(min-width: 760px)").matches,
  );
  const [subPage, setSubPage] = useState(1);
  const bookRef = useRef<HTMLDivElement>(null);
  const leaves = useRef(new Map<number, HTMLDivElement>());
  const frame = useRef(0),
    epoch = useRef(0),
    resting = useRef(1);
  const current = useRef(spread);
  current.current = spread;
  const reduced = useRef(
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const busy = useRef(false);
  const drag = useRef<{
    index: number;
    side: "left" | "right";
    x: number;
    spine: number;
    width: number;
    theta: number;
    moved: boolean;
  } | null>(null);

  const reset = useCallback(() => {
    cancelAnimationFrame(frame.current);
    epoch.current++;
    busy.current = false;
    drag.current = null;
    for (const leaf of leaves.current.values()) clearLeaf(leaf);
    const book = bookRef.current;
    book?.classList.remove("peek", "tilting");
    book?.style.removeProperty("transform");
  }, []);
  const go = useCallback(
    (target: number, startAngle?: number) => {
      const from = current.current,
        to = Math.max(0, Math.min(leafCount, target));
      if (from === to && startAngle === undefined) return;
      const draggedIndex = drag.current?.index;
      reset();
      const version = epoch.current;
      const indices: number[] = [];
      if (draggedIndex !== undefined) indices.push(draggedIndex);
      else if (to > from) for (let i = from; i < to; i++) indices.push(i);
      else for (let i = from - 1; i >= to; i--) indices.push(i);
      const forward = to > from;
      const starts = indices.map((i) => startAngle ?? (i < from ? Math.PI : 0));
      const ends = indices.map((i) => (i < to ? Math.PI : 0));
      current.current = to;
      flushSync(() => setSpread(to));
      // Commit the new spread before applying imperative turn classes. React's
      // className update would otherwise remove `dragging`, allowing the closed
      // cover's idle animation to override its in-progress rotation.
      if (!reduced.current)
        indices.forEach((index, j) => {
          const leaf = leaves.current.get(index);
          if (leaf) {
            leaf.classList.add("dragging");
            bendLeaf(leaf, starts[j]);
          }
        });
      if (to > 0 && to < leafCount) resting.current = to;
      const finish = () => {
        leaves.current.forEach((leaf, index) => {
          clearLeaf(leaf);
          leaf.style.zIndex = String(leafOrder(index, to, leafCount));
        });
        busy.current = false;
      };
      if (reduced.current) {
        finish();
        return;
      }
      busy.current = true;
      const start = performance.now();
      const animate = (now: number) => {
        if (epoch.current !== version) return;
        let done = true;
        indices.forEach((index, j) => {
          const leaf = leaves.current.get(index);
          if (!leaf) return;
          const progress = Math.max(
            0,
            Math.min(1, (now - start - j * 80) / TURN_MS),
          );
          if (progress < 1) done = false;
          leaf.style.zIndex = String(
            leafCount + 2 + (forward ? j : indices.length - j),
          );
          bendLeaf(
            leaf,
            starts[j] +
              (ends[j] - starts[j]) *
                (0.5 - 0.5 * Math.cos(Math.PI * progress)),
          );
        });
        if (done) finish();
        else frame.current = requestAnimationFrame(animate);
      };
      frame.current = requestAnimationFrame(animate);
    },
    [leafCount, reset],
  );
  const goRef = useRef(go);
  goRef.current = go;

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reduced.current = media.matches;
    };
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
      reset();
    };
  }, [reset]);
  useEffect(() => {
    const media = matchMedia("(min-width: 760px)");
    const sync = () => {
      setWide(media.matches);
      setSubPage(1);
      // A folding-width transition closes the cover, without modifying saved pages.
      goRef.current(
        media.matches ? Math.min(resting.current, leafCount - 1) : 0,
      );
    };
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [leafCount]);
  useEffect(() => {
    let active = true;
    if (current.current > leafCount)
      queueMicrotask(() => { if (active) goRef.current(leafCount); });
    return () => { active = false; };
  }, [leafCount]);
  useEffect(() => {
    // Open to the first spread on a large display; the outer display starts closed.
    if (!wide) return;
    const timer = setTimeout(() => {
      if (matchMedia("(min-width: 760px)").matches) goRef.current(1);
    }, 450);
    return () => clearTimeout(timer);
    // Initial entry only. Later pose changes restore the reading position above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mobileSteps = [{ spread: 0, sub: 1 }];
  for (let i = 1; i < leafCount; i++)
    for (const sub of [0, 1]) {
      const page = 2 * i - 3 + sub;
      if (page >= 0 && page <= pageCount) mobileSteps.push({ spread: i, sub });
    }
  mobileSteps.push({ spread: leafCount, sub: 0 });
  function step(direction: number) {
    if (blocked) return;
    if (wide) go(spread + direction);
    else {
      const index = mobileSteps.findIndex(
        (p) => p.spread === spread && p.sub === subPage,
      );
      const next =
        mobileSteps[
          Math.max(
            0,
            Math.min(mobileSteps.length - 1, Math.max(0, index) + direction),
          )
        ];
      setSubPage(next.sub);
      go(next.spread);
    }
  }
  function goDot(target: number) {
    if (blocked) return;
    const first = mobileSteps.find((p) => p.spread === target);
    if (first) setSubPage(first.sub);
    go(target);
  }
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        blocked ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            'input,textarea,select,dialog,[contenteditable="true"]',
          ))
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        stepRef.current(event.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [blocked]);
  const pointerProps = (side: "left" | "right") => ({
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (blocked || busy.current) return;
      const index = side === "right" ? current.current : current.current - 1;
      const leaf = leaves.current.get(index),
        book = bookRef.current;
      if (!leaf || !book) return;
      reset();
      const rect = book.getBoundingClientRect();
      drag.current = {
        index,
        side,
        x: event.clientX,
        spine: rect.left + rect.width / 2,
        width: rect.width / 2,
        theta: side === "right" ? 0 : Math.PI,
        moved: false,
      };
      leaf.classList.add("dragging");
      leaf.style.zIndex = String(leafCount + 2);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const d = drag.current;
      if (!d) return;
      if (Math.abs(event.clientX - d.x) > 4) d.moved = true;
      d.theta = Math.acos(
        Math.max(-1, Math.min(1, (event.clientX - d.spine) / d.width)),
      );
      const leaf = leaves.current.get(d.index);
      if (leaf) bendLeaf(leaf, d.theta);
    },
    onPointerUp() {
      const d = drag.current;
      if (!d) return;
      if (!d.moved) {
        drag.current = null;
        step(d.side === "right" ? 1 : -1);
        return;
      }
      go(d.theta > Math.PI / 2 ? d.index + 1 : d.index, d.theta);
    },
    onPointerCancel() {
      const d = drag.current;
      if (d) go(current.current, d.theta);
    },
    onLostPointerCapture() {
      const d = drag.current;
      if (d) go(current.current, d.theta);
    },
  });
  function onMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (
      reduced.current ||
      spread !== 0 ||
      busy.current ||
      drag.current ||
      blocked ||
      !wide
    )
      return;
    const book = bookRef.current;
    if (!book) return;
    const rect = book.getBoundingClientRect(),
      cx = rect.left + 0.75 * rect.width,
      cy = rect.top + rect.height / 2;
    const x = Math.max(
        -0.6,
        Math.min(0.6, (event.clientX - cx) / (rect.width / 2)),
      ),
      y = Math.max(-0.6, Math.min(0.6, (event.clientY - cy) / rect.height));
    book.classList.add("peek", "tilting");
    book.style.setProperty(
      "--peek",
      `${-(12 + 26 * Math.max(0, Math.min(1, (event.clientX - cx) / (0.25 * rect.width))))}deg`,
    );
    book.style.transform = `translateX(${-book.offsetWidth / 4}px) rotateY(${9 * x}deg) rotateX(${-9 * y}deg)`;
    book.style.setProperty("--cbx", `${-16 * x}px`);
    book.style.setProperty("--cby", `${-16 * y}px`);
  }
  return {
    spread,
    wide,
    subPage,
    leafCount,
    bookRef,
    leaves,
    go: goDot,
    step,
    pointerProps,
    onMouseMove,
    onMouseLeave() {
      if (!busy.current && !drag.current) {
        bookRef.current?.classList.remove("peek", "tilting");
        bookRef.current?.style.removeProperty("transform");
      }
    },
  };
}
