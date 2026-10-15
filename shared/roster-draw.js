export const ROSTER_LIMIT = 10000;

// CSV and TSV accept a name column and an optional unique id column. Plain
// text is deliberately simpler: each non-empty line is one entry.
export function parseRoster(text, format = "csv") {
  if (typeof text !== "string" || text.length > 1_000_000)
    throw new Error("名單檔案過大（上限 1 MB）。");
  text = text.replace(/^\uFEFF/, "");
  let rows;
  if (format === "txt") rows = text.split(/\r?\n/).map((name) => [name]);
  else {
    const delimiter = format === "tsv" ? "\t" : ",";
    rows = [];
    let row = [],
      field = "",
      quoted = false,
      closed = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') {
          field += '"';
          i++;
        } else if (c === '"') {
          quoted = false;
          closed = true;
        } else field += c;
      } else if (c === '"' && !field && !closed) quoted = true;
      else if (c === delimiter) {
        row.push(field);
        field = "";
        closed = false;
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        closed = false;
      } else if (closed || c === '"')
        throw new Error("CSV 引號格式錯誤，請重新匯出。");
      else field += c;
    }
    if (quoted) throw new Error("CSV 有未結束的引號。");
    row.push(field);
    rows.push(row);
  }
  rows = rows.filter((row) => row.some((value) => value.trim()));
  let nameColumn = 0,
    idColumn = -1;
  if (format !== "txt") {
    const header =
      rows.shift()?.map((value) => value.trim().toLowerCase()) ?? [];
    nameColumn = header.findIndex((value) =>
      ["name", "姓名", "名字"].includes(value),
    );
    idColumn = header.findIndex((value) =>
      ["id", "編號", "票號"].includes(value),
    );
    if (nameColumn < 0)
      throw new Error("CSV／TSV 第一列需要 name 或「姓名」欄位。");
    if (rows.some((row) => row.length !== header.length))
      throw new Error("CSV／TSV 各列欄位數不一致。");
  }
  if (!rows.length || rows.length > ROSTER_LIMIT)
    throw new Error(`名單需要 1–${ROSTER_LIMIT} 個名額。`);
  const seen = new Set();
  return rows.map((row, index) => {
    const name = (row[nameColumn] ?? "").trim().normalize("NFC");
    const id =
      idColumn >= 0
        ? (row[idColumn] ?? "").trim().normalize("NFC")
        : String(index + 1).padStart(6, "0");
    if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name))
      throw new Error(`第 ${index + 1} 個名額的姓名無效（需 1–100 字）。`);
    if (!id || id.length > 80 || /[\u0000-\u001f\u007f]/.test(id))
      throw new Error(`第 ${index + 1} 個名額的編號無效。`);
    if (seen.has(id))
      throw new Error(`編號「${id}」重複；每個名額必須有獨立編號。`);
    seen.add(id);
    return { id, name };
  });
}
