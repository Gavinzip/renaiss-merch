import { useRef, useState } from "react";
import { parseRoster, type RosterEntry } from "../../../shared/roster-draw.js";

export function RosterUpload({
  locked,
  busy,
  hasRoster,
  onUpload,
  onClear,
}: {
  locked: boolean;
  busy: boolean;
  hasRoster: boolean;
  onClear: () => Promise<void>;
  onUpload: (
    text: string,
    format: "csv" | "tsv" | "txt",
    title: string,
  ) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<{
    text: string;
    format: "csv" | "tsv" | "txt";
    title: string;
    entries: RosterEntry[];
  } | null>(null);
  const [error, setError] = useState("");
  async function read(file?: File) {
    if (!file) return;
    setError("");
    setDraft(null);
    try {
      if (file.size > 1_000_000) throw new Error("檔案上限為 1 MB。");
      const format = file.name.split(".").pop()?.toLowerCase();
      if (format !== "csv" && format !== "txt" && format !== "tsv")
        throw new Error(
          "請上傳 UTF-8 CSV、TSV 或 TXT。Excel 請先匯出為 CSV UTF-8。",
        );
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      setDraft({
        text,
        format,
        title: file.name,
        entries: parseRoster(text, format),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "讀取失敗。");
    }
  }
  return (
    <section className="roster-upload">
      <div>
        <h3>上傳與管理</h3>
        <p>支援 CSV、TSV 或 TXT，每列一個抽獎名額。</p>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept=".csv,.tsv,.txt"
        aria-label="上傳抽獎名單"
        disabled={busy || locked}
        onChange={(event) => void read(event.target.files?.[0])}
      />
      <div className="roster-upload__actions">
        <button type="button" className="roster-primary" disabled={busy || locked}
          onClick={() => input.current?.click()}>
          上傳名單 <span aria-hidden="true">↗</span>
        </button>
        <button type="button" className="roster-upload__clear" disabled={busy || !hasRoster}
          onClick={async () => {
            if (!window.confirm('清空目前名單並結束本輪？\n舊名單與中獎紀錄會保留於伺服器；頁面將重設，可重新上傳。')) return;
            try {
              await onClear();
            } catch {
              // The parent displays the server error and retains the current roster.
            }
          }}>
          清空目前名單
        </button>
      </div>
      {locked ? (
        <p className="roster-note">名單已鎖定，清空後可上傳新名單。</p>
      ) : (
        <div className="roster-note">
          <p>CSV／TSV 請包含 <code>name</code> 欄，<code>id</code> 選填；TXT 每行一個姓名。</p>
          <p>相同姓名、不同編號視為不同名額；已中獎名額會從兩種抽獎中排除。</p>
          <a
            download="renaiss-roster-template.csv"
            href={
              "data:text/csv;charset=utf-8," +
              encodeURIComponent(
                "\uFEFFid,name\n001,示範姓名一\n002,示範姓名二\n",
              )
            }
          >
            下載範本 ↗
          </a>
        </div>
      )}
      {error ? (
        <p role="alert" className="roster-error">
          {error}
        </p>
      ) : null}
      {draft && !locked ? (
        <div className="roster-upload__preview">
          <strong>
            {draft.title} · {draft.entries.length.toLocaleString()} 個名額
          </strong>
          <ul>
            {draft.entries.slice(0, 6).map((entry) => (
              <li key={entry.id}>
                <code>{entry.id}</code>
                <span>{entry.name}</span>
              </li>
            ))}
          </ul>
          {draft.entries.length > 6 ? (
            <small>另有 {draft.entries.length - 6} 個名額</small>
          ) : null}
          <button
            className="roster-primary"
            disabled={busy}
            type="button"
            onClick={async () => {
              try {
                await onUpload(draft.text, draft.format, draft.title);
                setDraft(null);
                if (input.current) input.current.value = "";
              } catch {
                /* Parent shows the server error; keep the preview for retry. */
              }
            }}
          >
            {busy ? "保存中…" : "確認使用這份名單"} ↗
          </button>
        </div>
      ) : null}
    </section>
  );
}
