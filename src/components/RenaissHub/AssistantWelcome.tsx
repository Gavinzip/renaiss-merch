import type { HubAssistantCopy } from "./HubAssistantCopy";
import { AssistantBrand } from "./AssistantBrand";

function PromptIcon({ index }: { index: number }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{index === 0 ? <><circle cx="12" cy="12" r="7.5" /><ellipse cx="12" cy="12" rx="3.5" ry="7.5" /><path d="M4.5 12h15" /></> : index === 1 ? <><path d="m12 3 7 4v9l-7 5-7-5V7Z" /><path d="m8.5 12 2.4 2.4 4.6-4.8" /></> : <><path d="M5 17V9M11 17V5M17 17v-5M4 20h16" /><path d="m15 5 3-2 3 2" /></>}</svg>;
}

export function AssistantWelcome({ copy, question, onChoose }: { copy: HubAssistantCopy; question: string; onChoose: (question: string) => void }) {
  return <div className="assistant-welcome">
    <div className="assistant-welcome__intro"><div className="assistant-welcome__text"><h3>{copy.welcomeTitle}</h3><p className="assistant-welcome__description">{copy.welcomeDescription}</p></div><AssistantBrand /></div>
    <div className="assistant-suggestions">{copy.suggestions.map((suggestion, index) => <button key={suggestion} type="button" data-tone={index} aria-pressed={question === suggestion} onClick={() => onChoose(suggestion)}>
      <span className="assistant-suggestions__top"><span className="assistant-suggestions__icon"><PromptIcon index={index} /></span><span>{copy.suggestionLabels[index]}</span><svg className="assistant-suggestions__arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" /></svg></span><strong>{suggestion}</strong>
    </button>)}</div>
  </div>;
}
