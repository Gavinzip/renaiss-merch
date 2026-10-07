"use client";

// Adapted from agent-ui's local Chat primitive (MIT; see LICENSE.txt).
// Caller-owned service state replaces the demo conversation and timers.
import { useRef } from "react";
import type { AppLocale } from "../../../i18n/LocaleContext";
import type { AssistantMessage } from "../useHubAssistant";
import type { HubAssistantCopy } from "../HubAssistantCopy";
import { HubAssistantAnswer } from "../HubAssistantAnswer";
import { AssistantMark } from "../AssistantMark";
import { AssistantAnswerActions } from "../AssistantAnswerActions";
import { AssistantWelcome } from "../AssistantWelcome";
import { AssistantComposer } from "../AssistantComposer";
import { AssistantFollowUps } from "../AssistantFollowUps";
import { AssistantRequestNotice } from "../AssistantRequestNotice";
import { useAssistantScroll } from "../useAssistantScroll";
import { LoadingState } from "./LoadingState";
import { ContextCards } from "./ContextCards";

type ChatProps = {
  copy: HubAssistantCopy; locale: AppLocale; active: boolean;
  messages: AssistantMessage[]; status: "idle" | "waiting" | "slow";
  error: "unavailable" | "busy" | "timeout" | null; cancelled: boolean; question: string;
  onQuestion: (value: string) => void; onSend: () => void;
  onCancel: () => void; onRetry: () => void;
};

export function AgentChat({ copy, locale, active, messages, status, error, cancelled, question, onQuestion, onSend, onCancel, onRetry }: ChatProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = status !== "idle";
  const scroll = useAssistantScroll(messages, busy, error);
  const suggest = (value: string) => { onQuestion(value); inputRef.current?.focus(); };
  return <div className="agent-chat" lang={locale}>
    <div className="assistant-thread" ref={scroll.thread} role="log" aria-label={copy.title} aria-live="polite" aria-relevant="additions" onScroll={scroll.onScroll}>
      {messages.length === 0 ? <AssistantWelcome copy={copy} question={question} onChoose={suggest} /> : <div className="assistant-messages">{messages.map(message => <div className={`assistant-message is-${message.role}`} key={message.id} data-message-id={message.id} tabIndex={-1}>
        {message.role === "assistant" ? <>
          <div className="assistant-message__identity"><AssistantMark /><span>Renaiss</span><AssistantAnswerActions text={message.content} label={copy.copyAnswer} copiedLabel={copy.copied} errorLabel={copy.copyError} /></div>
          <HubAssistantAnswer text={message.content} sources={message.sources} sourceLabel={copy.sources} />
          {message.sources?.length ? <ContextCards sources={message.sources} label={copy.sources} countLabel={copy.sourceCount} /> : null}
          {message.id === messages.at(-1)?.id && !busy && !error && !cancelled ? <AssistantFollowUps label={copy.followUpLabel} questions={copy.followUpQuestions} onChoose={suggest} /> : null}
        </> : <p>{message.content}</p>}
      </div>)}</div>}
      {busy ? <LoadingState label={status === "slow" ? copy.slow : copy.waiting} /> : null}
      <AssistantRequestNotice copy={copy} error={error} cancelled={cancelled} onRetry={() => { onRetry(); inputRef.current?.focus(); }} />
    </div>
    <div className="assistant-composer-area">
      {scroll.unread ? <button className="assistant-new-reply" type="button" onClick={scroll.revealReply}>{copy.newReply}<span aria-hidden="true">↓</span></button> : null}
      <AssistantComposer copy={copy} active={active} busy={busy} question={question} inputRef={inputRef} onQuestion={onQuestion} onSend={onSend} onCancel={onCancel} />
      <p className="assistant-beta-note">{copy.beta}</p>
    </div>
  </div>;
}
