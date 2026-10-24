import { useCallback, useEffect, useRef, useState } from "react";
import {
  BINDER_INK_COLORS,
  BINDER_MAX_MARKS,
  BINDER_MAX_POINTS,
  validateWriting,
  type BinderMark,
  type BinderWriting,
} from "../../../shared/binder-writing.js";
import type { MemberBinder } from "../../../shared/member-binder.js";

export type WritingTool = "read" | "pen" | "text" | "erase";
export function useBinderWriting(
  binder: MemberBinder,
  onChange: (writing: BinderWriting) => void,
  locked: boolean,
) {
  const [tool, setTool] = useState<WritingTool>("read");
  const [color, setColor] = useState(BINDER_INK_COLORS[0]);
  const [size, setSize] = useState(1);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(false);
  const [history, setHistory] = useState<BinderWriting[]>([]);
  const current = useRef({ binder, onChange, locked });
  current.current = { binder, onChange, locked };
  const pages = binder.pages.map((p) => p.id).join(",");
  useEffect(() => {
    setHistory([]);
  }, [pages]);
  const update = useCallback((surface: string, marks: BinderMark[]) => {
    const {
      binder: book,
      onChange: change,
      locked: disabled,
    } = current.current;
    if (disabled) return false;
    const previous = book.writing || {};
    try {
      const next = validateWriting(
        { ...previous, [surface]: marks },
        book.pages.map((p) => p.id),
      )!;
      setHistory((h) => [...h.slice(-39), previous]);
      setLimit(false);
      change(next);
      return true;
    } catch {
      setLimit(true);
      return false;
    }
  }, []);
  const marks = Object.values(binder.writing || {}).flat();
  return {
    tool: locked ? ("read" as const) : tool,
    setTool,
    color,
    setColor,
    size,
    setSize,
    busy,
    setBusy,
    limit,
    setLimit,
    update,
    writing: binder.writing || {},
    canUndo: history.length > 0,
    remainingMarks: BINDER_MAX_MARKS - marks.length,
    remainingPoints:
      BINDER_MAX_POINTS -
      marks.reduce(
        (sum, mark) => sum + (mark.kind === "stroke" ? mark.points.length : 0),
        0,
      ),
    undo() {
      if (locked || busy || !history.length) return;
      onChange(history[history.length - 1]);
      setHistory((h) => h.slice(0, -1));
      setLimit(false);
    },
  };
}
export type BinderWritingController = ReturnType<typeof useBinderWriting>;
