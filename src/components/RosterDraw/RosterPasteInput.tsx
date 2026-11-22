import './RosterPasteInput.css';
import { useState } from "react";
export function RosterPasteInput({
  disabled,
  onPreview,
}: {
  disabled: boolean;
  onPreview: (text: string, title: string) => void;
}) {
  const [title, setTitle] = useState(""),
    [text, setText] = useState("");
  return (
    <fieldset className="roster-paste" disabled={disabled}>
      <legend>直接貼上名單</legend>
      <label>
        本輪名稱
        <input
          value={title}
          maxLength={120}
          placeholder="例如：現場抽獎第一輪"
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label>
        姓名 · 每行一個名額
        <textarea
          value={text}
          rows={6}
          maxLength={1_000_000}
          placeholder={"王小明\n陳小華\n林小美"}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="roster-secondary"
        disabled={!title.trim() || !text.trim()}
        onClick={() => onPreview(text, title.trim())}
      >
        檢查與預覽名單 ↗
      </button>
    </fieldset>
  );
}
