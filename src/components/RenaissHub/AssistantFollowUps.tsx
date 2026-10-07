// Follow-up layout adapted from agent-ui's local Streaming Text primitive
// (MIT; see agent-ui/LICENSE.txt). Suggestions are authored prompts, not
// generated answers; selection fills the composer and never submits itself.
export function AssistantFollowUps({ label, questions, onChoose }: { label: string; questions: readonly string[]; onChoose: (question: string) => void }) {
  return <div className="assistant-follow-ups"><p>{label}</p><div>{questions.map(question => <button key={question} type="button" onClick={() => onChoose(question)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15 4v5a4 4 0 0 1-4 4H4m4-4-4 4 4 4" /></svg><span>{question}</span><span aria-hidden="true">↗</span></button>)}</div></div>;
}
