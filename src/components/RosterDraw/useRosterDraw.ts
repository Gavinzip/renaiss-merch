import { useCallback, useEffect, useRef, useState } from "react";
import type { RosterKind, RosterState, RosterWinner } from "./types";

const ROOT = "/api/draw-room/roster";
const messages: Record<string, string> = {
  prize_name_required: "請填寫 1–60 字的獎項名稱。",
  roster_changed: "名單已被另一個視窗更新，請重新載入。",
  draw_state_changed: "另一個視窗已完成抽獎，請重新讀取後再操作。",
  roster_locked_after_first_draw: "已開始抽獎，名單已鎖定，不能覆蓋中獎紀錄。",
  roster_exhausted: "名單中的所有名額都已中獎。",
  surf_draw_access_required: "開獎室登入已過期，請重新登入。",
};
class RosterRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function request(path = "", body?: unknown) {
  const response = await fetch(ROOT + path, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw new RosterRequestError(
      messages[data.code] || data.code || `HTTP ${response.status}`,
      response.status,
    );
  return data;
}
export function useRosterDraw() {
  const [state, setState] = useState<RosterState | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(true),
    [pendingDraw, setPendingDraw] = useState<{ kind: RosterKind; prize: string } | null>(null);
  const lock = useRef(false);
  const readRevision = useRef(0);
  const attempt = useRef<{
    requestId: string;
    rosterId: string;
    expectedCount: number;
    kind: RosterKind;
    prize: string;
  } | null>(null);
  const refresh = useCallback(async () => {
    if (lock.current) return;
    const revision = ++readRevision.current;
    setRefreshing(true);
    try {
      const next = await request();
      if (revision !== readRevision.current) return;
      setState(next);
      setError("");
    } catch (reason) {
      if (revision !== readRevision.current) return;
      setError(reason instanceof Error ? reason.message : "無法讀取名單。");
    } finally {
      if (revision === readRevision.current) setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => { ++readRevision.current; };
  }, [refresh]);
  async function upload(
    text: string,
    format: "csv" | "tsv" | "txt",
    title: string,
  ) {
    if (lock.current || attempt.current) return;
    lock.current = true;
    ++readRevision.current;
    setRefreshing(false);
    setBusy(true);
    setError("");
    try {
      setState(
        await request("/upload", {
          text,
          format,
          title,
          previousId: state?.roster?.id ?? null,
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "上傳失敗。");
      throw reason;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function draw(kind: RosterKind, prize: string): Promise<RosterWinner> {
    if (lock.current || (!attempt.current && !state?.roster)) throw new Error("請先載入名單。");
    if (attempt.current && (attempt.current.kind !== kind || attempt.current.prize !== prize))
      throw new Error("請先回到原獎項重試，確認上一次抽獎結果。");
    lock.current = true;
    ++readRevision.current;
    setRefreshing(false);
    setBusy(true);
    setError("");
    attempt.current ??= {
      requestId: crypto.randomUUID(),
      rosterId: state!.roster!.id,
      expectedCount: state!.winners.length,
      kind,
      prize,
    };
    try {
      const next = await request("/draw", attempt.current);
      setState(next);
      attempt.current = null;
      setPendingDraw(null);
      return next.result;
    } catch (reason) {
      const rejected =
        reason instanceof RosterRequestError && reason.status < 500;
      if (rejected) attempt.current = null;
      setPendingDraw(rejected ? null : { kind, prize });
      setError(
        `${reason instanceof Error ? reason.message : "連線中斷。"}${rejected ? "" : " 重試會查詢同一次抽獎，不會另抽。"}`,
      );
      throw reason;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function clear() {
    if (lock.current || attempt.current || !state?.roster) return;
    lock.current = true;
    ++readRevision.current;
    setRefreshing(false);
    setBusy(true);
    setError("");
    try {
      setState(await request("/clear", {
        rosterId: state.roster.id,
        expectedCount: state.winners.length,
      }));
      attempt.current = null;
      setPendingDraw(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "清空失敗。");
      throw reason;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { state, error, busy, refreshing, retryPending: Boolean(pendingDraw), pendingDraw, refresh, upload, draw, clear };
}
