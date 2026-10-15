import { getMerchDatabase } from "../merch-database.mjs";
import { getRuntimeConfig } from "../runtime-config.mjs";
import { requireSurfDrawAccess } from "../surf-draw/access.mjs";
import { getPublicOrigin } from "../config.mjs";
import { HttpError, sendJson } from "../http.mjs";
import { createRosterStore } from "./store.mjs";

const ROOT = "/api/draw-room/roster";
export async function handleRosterDrawRoute(req, res, url) {
  if (url.pathname !== ROOT && !url.pathname.startsWith(`${ROOT}/`))
    return false;
  const action = url.pathname.slice(ROOT.length);
  if (!["", "/upload", "/draw", "/clear"].includes(action))
    throw new HttpError(404, "not_found");
  if (req.method !== (action ? "POST" : "GET"))
    throw new HttpError(405, "method_not_allowed");
  const access = requireSurfDrawAccess(req);
  if (action && req.headers.origin !== getPublicOrigin(req))
    throw new HttpError(403, "invalid_request_origin");
  const store = createRosterStore(
    getMerchDatabase(getRuntimeConfig().databasePath),
  );
  if (!action) {
    sendJson(res, 200, store.state());
    return true;
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4_000_000) throw new HttpError(413, "request_too_large");
    chunks.push(Buffer.from(chunk));
  }
  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new HttpError(400, "invalid_json");
  sendJson(
    res,
    200,
    action === "/upload"
      ? store.upload(input, access.username)
      : action === "/clear"
        ? store.clear(input, access.username)
        : store.draw(input, access.username),
  );
  return true;
}
