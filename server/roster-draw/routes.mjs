import { getWorkflowDatabase as getMerchDatabase } from "../postgres/statements.mjs";
import { requireSurfDrawAccess } from "../surf-draw/access.mjs";
import { getPublicOrigin } from "../config.mjs";
import { HttpError, sendJson } from "../http.mjs";
import { createRosterStore } from "./store.mjs";
import { readJsonBody } from "../request-json.mjs";
export function createRosterDrawRoute({
  root: ROOT,
  requireAccess,
  database,
  storeOptions,
}) {
  return async function handleRosterDrawRoute(req, res, url) {
    if (url.pathname !== ROOT && !url.pathname.startsWith(`${ROOT}/`))
      return false;
    const action = url.pathname.slice(ROOT.length);
    if (!["", "/upload", "/draw", "/clear"].includes(action))
      throw new HttpError(404, "not_found");
    if (req.method !== (action ? "POST" : "GET"))
      throw new HttpError(405, "method_not_allowed");
    const access = await requireAccess(req);
    if (action && req.headers.origin !== getPublicOrigin(req))
      throw new HttpError(403, "invalid_request_origin");
    const store = createRosterStore(database(), storeOptions);
    if (!action) {
      sendJson(res, 200, await store.state());
      return true;
    }
    const input = await readJsonBody(req, 4_000_000);
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new HttpError(400, "invalid_json");
    sendJson(
      res,
      200,
      action === "/upload"
        ? await store.upload(input, access.username)
        : action === "/clear"
          ? await store.clear(input, access.username)
          : await store.draw(input, access.username),
    );
    return true;
  };
}
export const handleRosterDrawRoute = createRosterDrawRoute({
  root: "/api/draw-room/roster",
  requireAccess: requireSurfDrawAccess,
  database: getMerchDatabase,
});
