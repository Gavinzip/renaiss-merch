import type { ReactNode } from "react";
import type { AssistantSource } from "./useHubAssistant";

function inline(text: string, sources: AssistantSource[] | undefined, sourceLabel: string) {
  function citations(value: string) {
    return value.split(/(\[\d+\])/g).map((part, index) => {
      const match = /^\[(\d+)\]$/.exec(part);
      const source = match && sources?.find(item => item.citation === Number(match[1]));
      return source ? <a className="assistant-citation" key={index} href={source.url} target="_blank" rel="noopener noreferrer" title={source.title} aria-label={`${sourceLabel} ${source.citation}: ${source.title}`}>{source.citation}</a> : part;
    });
  }
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**")
    ? <strong key={index}>{citations(part.slice(2, -2))}</strong> : citations(part));
}

// The knowledge service returns Markdown. Render its common text structures
// with React escaping; raw HTML and arbitrary link markup are never executed.
export function HubAssistantAnswer({ text, sources, sourceLabel }: { text: string; sources?: AssistantSource[]; sourceLabel: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let paragraph: string[] = [];
  function flush() {
    if (paragraph.length) blocks.push(<p key={blocks.length}>{inline(paragraph.join("\n"), sources, sourceLabel)}</p>);
    paragraph = [];
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) { flush(); continue; }
    if (/^#{1,6} /.test(line)) {
      flush(); blocks.push(<h4 key={blocks.length}>{inline(line.replace(/^#{1,6} /, ""), sources, sourceLabel)}</h4>);
    } else if (/^([-*_])\1{2,}$/.test(line)) {
      flush(); blocks.push(<hr key={blocks.length} />);
    } else if (/^[-*] /.test(line) || /^\d+\. /.test(line)) {
      flush();
      const ordered = /^\d+\. /.test(line);
      const pattern = ordered ? /^\d+\. / : /^[-*] /;
      const items: string[] = [line.replace(pattern, "")];
      while (index + 1 < lines.length && pattern.test(lines[index + 1].trim())) items.push(lines[++index].trim().replace(pattern, ""));
      const content = items.map((item, itemIndex) => <li key={itemIndex}>{inline(item, sources, sourceLabel)}</li>);
      blocks.push(ordered ? <ol key={blocks.length} start={parseInt(line, 10)}>{content}</ol> : <ul key={blocks.length}>{content}</ul>);
    } else if (/^> /.test(line)) {
      flush(); const quote = [line.slice(2)];
      while (index + 1 < lines.length && /^> /.test(lines[index + 1].trim())) quote.push(lines[++index].trim().slice(2));
      blocks.push(<blockquote key={blocks.length}>{inline(quote.join("\n"), sources, sourceLabel)}</blockquote>);
    } else paragraph.push(line);
  }
  flush();
  return <div className="hub-assistant__answer">{blocks}</div>;
}
