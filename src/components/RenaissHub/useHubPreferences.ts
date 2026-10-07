import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDefaultHubPreferences,
  validateHubPreferences,
  type HubPreferences,
} from "../../../shared/hub-preferences.js";
import type { AccountState } from "./RenaissHubFeatures";

const GUEST_STORAGE_KEY = "renaiss.home.guest.v1";
type PreferencesState = "loading" | "ready" | "error";

export function useHubPreferences(account: AccountState) {
  const [preferences, setPreferences] = useState<HubPreferences>(
    createDefaultHubPreferences,
  );
  const [loadedIdentity, setLoadedIdentity] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState<PreferencesState>("loading");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [revision, setRevision] = useState(0);
  const identity =
    account.status === "ready"
      ? account.session.authenticated
        ? account.session.user.sub
        : null
      : undefined;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;

  useEffect(() => {
    if (identity === undefined) {
      setStatus(account.status === "error" ? "error" : "loading");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    setSaveError(false);
    void (async () => {
      try {
        let value: unknown;
        if (identity === null) {
          const stored = localStorage.getItem(GUEST_STORAGE_KEY);
          value =
            stored === null
              ? createDefaultHubPreferences()
              : JSON.parse(stored);
        } else {
          const response = await fetch("/api/hub/preferences", {
            cache: "no-store",
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
          });
          if (!response.ok) throw new Error("preferences_unavailable");
          const result = (await response.json()) as { preferences: unknown };
          value =
            result.preferences === null
              ? createDefaultHubPreferences()
              : result.preferences;
        }
        const next = validateHubPreferences(value);
        if (!controller.signal.aborted) {
          setPreferences(next);
          setLoadedIdentity(identity);
          setStatus("ready");
        }
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    })();
    return () => controller.abort();
  }, [identity, account.status, revision]);

  const save = useCallback(
    async (value: HubPreferences) => {
      if (identity === undefined) return false;
      setSaving(true);
      setSaveError(false);
      try {
        const next = validateHubPreferences(value);
        if (identity === null)
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(next));
        else {
          const response = await fetch("/api/hub/preferences", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next),
          });
          if (!response.ok) throw new Error("preferences_not_saved");
          validateHubPreferences(
            ((await response.json()) as { preferences: unknown }).preferences,
          );
        }
        if (currentIdentity.current !== identity) return false;
        setPreferences(next);
        setLoadedIdentity(identity);
        setStatus("ready");
        return true;
      } catch {
        if (currentIdentity.current === identity) setSaveError(true);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [identity],
  );

  return {
    preferences: loadedIdentity === identity ? preferences : createDefaultHubPreferences(),
    status: status === "error" ? "error" : loadedIdentity === identity ? status : "loading",
    saving,
    saveError,
    save,
    retry: () => setRevision((value) => value + 1),
    accountStorage: typeof identity === "string",
  };
}
