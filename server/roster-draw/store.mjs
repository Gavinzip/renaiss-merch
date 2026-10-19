import { createHash, randomInt, randomUUID } from "node:crypto";
import { HttpError } from "../http.mjs";
import { parseRoster } from "../../shared/roster-draw.js";
export function createRosterStore(db) {
  const list = async () => await db.prepare("SELECT * FROM roster_draw_list WHERE singleton=1").get();
  const winners = async (rosterId = null) => {
    rosterId ??= (await list())?.id;
    return await db.prepare(`SELECT ROW_NUMBER() OVER (ORDER BY sequence) AS sequence,
    request_id AS requestId,entry_id AS entryId,name,kind,prize,
    drawn_at AS drawnAt FROM roster_draw_winners WHERE roster_id=? ORDER BY sequence DESC`).all(rosterId ?? null);
  };
  async function state() {
    const roster = await list(),
      results = await winners(roster?.id);
    return {
      roster: roster ? {
        id: roster.id,
        title: roster.title,
        hash: roster.hash,
        entries: JSON.parse(roster.entries_json),
        createdAt: roster.created_at
      } : null,
      winners: results,
      history: await db.prepare(`SELECT sequence, request_id AS requestId,
        entry_id AS entryId,name,kind,prize,drawn_at AS drawnAt
        FROM roster_draw_winners ORDER BY sequence DESC`).all()
    };
  }
  async function upload(input, operator) {
    if (!["csv", "tsv", "txt"].includes(input.format)) throw new HttpError(400, "unsupported_roster_format");
    let entries;
    try {
      entries = parseRoster(input.text, input.format);
    } catch (error) {
      throw new HttpError(400, error.message);
    }
    const title = typeof input.title === "string" ? input.title.trim().slice(0, 120) : "";
    if (!title) throw new HttpError(400, "roster_title_required");
    await db.transaction(async () => {
      const current = await list();
      if ((current?.id ?? null) !== input.previousId) throw new HttpError(409, "roster_changed");
      if ((await winners()).length) throw new HttpError(409, "roster_locked_after_first_draw");
      const json = JSON.stringify(entries),
        hash = createHash("sha256").update(json).digest("hex");
      await db.prepare(`INSERT INTO roster_draw_list VALUES(1,?,?,?,?,?,?) ON CONFLICT(singleton) DO UPDATE SET
        id=excluded.id,title=excluded.title,hash=excluded.hash,entries_json=excluded.entries_json,
        created_at=excluded.created_at,operator=excluded.operator`).run(randomUUID(), title, hash, json, new Date().toISOString(), operator);
    }).immediate();
    return await state();
  }
  async function draw(input, operator) {
    if (!/^[a-zA-Z0-9-]{20,80}$/.test(input.requestId || "") || !["charizard", "other"].includes(input.kind)) throw new HttpError(400, "invalid_draw_request");
    const prize = input.kind === "charizard" ? "噴火龍典藏禮盒" : typeof input.prize === "string" ? input.prize.trim() : "";
    if (!prize || prize.length > 60 || /[\u0000-\u001f]/.test(prize)) throw new HttpError(400, "prize_name_required");
    return await db.transaction(async () => {
      const current = await list();
      if (!current || current.id !== input.rosterId) throw new HttpError(409, "roster_changed");
      const previous = await db.prepare("SELECT * FROM roster_draw_winners WHERE request_id=?").get(input.requestId);
      if (previous) {
        if (previous.roster_id !== input.rosterId || previous.kind !== input.kind || previous.prize !== prize) throw new HttpError(409, "request_id_conflict");
        return {
          ...(await state()),
          result: (await winners()).find(item => item.requestId === input.requestId)
        };
      }
      const results = await winners();
      if (results.length !== input.expectedCount) throw new HttpError(409, "draw_state_changed");
      const won = new Set(results.map(item => item.entryId));
      const available = JSON.parse(current.entries_json).filter(entry => !won.has(entry.id));
      if (!available.length) throw new HttpError(409, "roster_exhausted");
      const entry = available[randomInt(available.length)];
      await db.prepare(`INSERT INTO roster_draw_winners(request_id,roster_id,entry_id,name,kind,prize,drawn_at,operator)
        VALUES(?,?,?,?,?,?,?,?)`).run(input.requestId, current.id, entry.id, entry.name, input.kind, prize, new Date().toISOString(), operator);
      return {
        ...(await state()),
        result: (await winners())[0]
      };
    }).immediate();
  }
  async function clear(input, operator) {
    if (typeof input.rosterId !== "string" || !input.rosterId || !Number.isSafeInteger(input.expectedCount) || input.expectedCount < 0) throw new HttpError(400, "invalid_clear_request");
    await db.transaction(async () => {
      const current = await list();
      // A lost response can be retried, but may never clear a newer roster.
      if (!current && (await db.prepare("SELECT id FROM roster_draw_archives WHERE id=?").get(input.rosterId))) return;
      if (!current || current.id !== input.rosterId) throw new HttpError(409, "roster_changed");
      if ((await winners(current.id)).length !== input.expectedCount) throw new HttpError(409, "draw_state_changed");
      await db.prepare(`INSERT INTO roster_draw_archives
        (id,title,hash,entries_json,created_at,operator,cleared_at,cleared_by)
        SELECT id,title,hash,entries_json,created_at,operator,?,?
        FROM roster_draw_list WHERE singleton=1`).run(new Date().toISOString(), operator);
      await db.prepare("DELETE FROM roster_draw_list WHERE singleton=1").run();
    }).immediate();
    return await state();
  }
  return {
    state,
    upload,
    draw,
    clear
  };
}
