import { useEffect, useRef, useState } from "react";
import type { AppLocale } from "../../i18n/LocaleContext";

export type AssistantSource = { citation: number; title: string; url: string };
export type AssistantMessage = { id: string; role: "user" | "assistant"; content: string; sources?: AssistantSource[] };
export function useHubAssistant(locale: AppLocale) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "waiting" | "slow">("idle");
  const [error, setError] = useState<"unavailable" | "busy" | "timeout" | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const request = useRef<AbortController | null>(null);
  const history = useRef<AssistantMessage[]>([]);
  const mounted = useRef(false);
  const lastQuestion = useRef("");

  function cancel() { if (request.current) { request.current.abort(); setCancelled(true); } request.current = null; setStatus("idle"); }
  function reset() { cancel(); history.current = []; lastQuestion.current = ""; setMessages([]); setError(null); setCancelled(false); }
  useEffect(() => {
    mounted.current = true;
    reset();
    return () => { mounted.current = false; request.current?.abort(); request.current = null; };
  }, [locale]);

  async function ask(question: string, retry = false) {
    if (request.current || !question.trim() || question.length > 1200) return;
    const controller = new AbortController();
    request.current = controller;
    setError(null);
    setCancelled(false);
    setStatus("waiting");
    const user: AssistantMessage = { id: crypto.randomUUID(), role: "user", content: question.trim() };
    lastQuestion.current = user.content;
    if (!retry) setMessages(current => [...current, user]);
    // Only completed exchanges enter history; retrying a failed question does
    // not submit an unanswered duplicate as context.
    const slowTimer = window.setTimeout(() => { if (request.current === controller) setStatus("slow"); }, 15_000);
    const timeout = window.setTimeout(() => controller.abort("timeout"), 95_000);
    try {
      const response = await fetch("/api/hub/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: user.content, locale, history: history.current.slice(-4).map(({ role, content }) => ({ role, content: content.slice(0, 800) })) }), signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 503 ? "busy" : response.status === 504 ? "timeout" : "unavailable");
      const result = await response.json();
      if (typeof result.answer !== "string" || !Array.isArray(result.sources)) throw new Error("unavailable");
      if (controller.signal.aborted || !mounted.current || request.current !== controller) return;
      const reply: AssistantMessage = { id: crypto.randomUUID(), role: "assistant", content: result.answer, sources: result.sources };
      history.current = [...history.current, user, reply].slice(-8);
      setMessages(current => [...current, reply]);
    } catch (failure) {
      if (!mounted.current || request.current !== controller) return;
      if (controller.signal.aborted) {
        if (controller.signal.reason === "timeout") setError("timeout");
      } else setError(failure instanceof Error && failure.message === "busy" ? "busy" : failure instanceof Error && failure.message === "timeout" ? "timeout" : "unavailable");
    } finally {
      window.clearTimeout(slowTimer); window.clearTimeout(timeout);
      if (request.current === controller) { request.current = null; if (mounted.current) setStatus("idle"); }
    }
  }
  return { messages, status, error, cancelled, ask, cancel, reset, retry: () => ask(lastQuestion.current, true) };
}
