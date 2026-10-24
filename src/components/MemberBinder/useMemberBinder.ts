import { useEffect, useRef, useState } from "react";
import type { MemberBinder } from "../../../shared/member-binder.js";
import {
  BinderApiError,
  readBinder,
  readLibrary,
  saveBinder,
  type BinderLibrary,
  type BinderSnapshot,
} from "./binderApi";

type State =
  | {
      identity: string;
      status: "ready";
      snapshot: BinderSnapshot;
      library: BinderLibrary;
    }
  | { identity: string; status: "loading" | "error" };
export function useMemberBinder(identity: string, wallet: string) {
  const [state, setState] = useState<State>({ identity, status: "loading" });
  const [draft, setDraft] = useState<MemberBinder | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<"error" | "conflict" | null>(null);
  const [request, setRequest] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const dirty = draft !== null;

  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    const timeout = window.setTimeout(() => abort.abort(), 45_000);
    setState({ identity, status: "loading" });
    setDraft(null);
    setSaveError(null);
    setSaving(false);
    if (identity && wallet)
      void Promise.all([
        readBinder(abort.signal),
        readLibrary(abort.signal, request > 0),
      ])
        .then(([snapshot, library]) => {
          if (library.walletAddress.toLowerCase() !== wallet.toLowerCase())
            throw new Error("Wallet changed");
          if (!abort.signal.aborted)
            setState({ identity, status: "ready", snapshot, library });
        })
        .catch(() => {
          if (active && currentIdentity.current === identity)
            setState({ identity, status: "error" });
        })
        .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      abort.abort();
      controller.current?.abort();
    };
  }, [identity, wallet, request]);

  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  const ready =
    state.identity === identity && state.status === "ready" ? state : null;
  return {
    status: state.identity === identity ? state.status : "loading",
    library: ready?.library,
    binder: ready ? draft || ready.snapshot.binder : null,
    persisted: Boolean(ready && ready.snapshot.revision > 0),
    dirty,
    saving,
    saveError,
    edit(binder: MemberBinder) {
      if (!saving) {
        setDraft(binder);
        setSaveError(null);
      }
    },
    reload() {
      setRequest((value) => value + 1);
    },
    async save() {
      if (!ready || !draft || saving) return;
      const owner = identity;
      const abort = new AbortController();
      controller.current = abort;
      const timeout = window.setTimeout(() => abort.abort(), 45_000);
      setSaving(true);
      setSaveError(null);
      try {
        const snapshot = await saveBinder(
          { ...ready.snapshot, binder: draft },
          abort.signal,
        );
        if (currentIdentity.current === owner && !abort.signal.aborted) {
          setState({ ...ready, snapshot });
          setDraft(null);
        }
      } catch (error) {
        if (currentIdentity.current === owner)
          setSaveError(
            error instanceof BinderApiError && error.status === 409
              ? "conflict"
              : "error",
          );
      } finally {
        clearTimeout(timeout);
        if (currentIdentity.current === owner) setSaving(false);
      }
    },
  };
}
