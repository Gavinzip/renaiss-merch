import { useLayoutEffect, useRef, useState } from "react";
import type { AssistantMessage } from "./useHubAssistant";

// Follow a new question, but let a long answer be read from its beginning.
// If the user scrolls back during a request, keep their place until they opt in.
export function useAssistantScroll(messages: AssistantMessage[], busy: boolean, error: string | null) {
  const thread = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const previousId = useRef<string | undefined>(undefined);
  const [unreadId, setUnreadId] = useState<string | null>(null);
  const last = messages.at(-1);

  function scrollToMessage(id: string, smooth = false) {
    const element = thread.current;
    const message = element && Array.from(element.querySelectorAll<HTMLElement>("[data-message-id]")).find(item => item.dataset.messageId === id);
    if (!element || !message) return;
    const top = element.scrollTop + message.getBoundingClientRect().top - element.getBoundingClientRect().top - 18;
    element.scrollTo({ top, behavior: smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "instant" });
    return message;
  }

  useLayoutEffect(() => {
    const element = thread.current;
    if (!element) return;
    if (!last) { previousId.current = undefined; following.current = true; setUnreadId(null); element.scrollTop = 0; return; }
    const added = previousId.current !== last.id;
    previousId.current = last.id;
    if (added && last.role === "user") {
      following.current = true;
      setUnreadId(null);
      element.scrollTop = element.scrollHeight;
    } else if (added && last.role === "assistant") {
      if (following.current) { scrollToMessage(last.id); setUnreadId(null); }
      else setUnreadId(last.id);
    } else if (following.current) element.scrollTop = element.scrollHeight;
  }, [last?.id, busy, error]);

  function onScroll() {
    const element = thread.current;
    if (!element) return;
    following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    if (following.current) setUnreadId(null);
  }
  function revealReply() {
    if (unreadId) scrollToMessage(unreadId, true)?.focus({ preventScroll: true });
    setUnreadId(null);
  }
  return { thread, onScroll, unread: unreadId !== null, revealReply };
}
