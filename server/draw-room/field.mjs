import { createDatabasePool } from "../postgres/database.mjs";
import { getWorkflowDatabase } from "../postgres/statements.mjs";
import { createDrawRoomAccess } from "./access.mjs";
import { createRosterDrawRoute } from "../roster-draw/routes.mjs";
import { HttpError } from "../http.mjs";
let pool;
export function fieldDrawDatabase() {
  const url = process.env.FIELD_DRAW_DATABASE_URL?.trim();
  if (!url) throw new HttpError(503, "field_draw_database_not_configured");
  pool ??= createDatabasePool(url);
  return getWorkflowDatabase(pool, "field_draw");
}
export const fieldDrawAccess = createDrawRoomAccess({
  root: "/api/auth/field-draw",
  cookie: "renaiss_field_draw_access",
  envPrefix: "FIELD_DRAW_ACCESS",
  codePrefix: "field_draw",
  fingerprintScope: "field-draw:",
  sessionTable: "draw_room_access_sessions",
  throttleTable: "draw_room_login_throttle",
  database: fieldDrawDatabase,
});
export const handleFieldRosterRoute = createRosterDrawRoute({
  root: "/api/field-draw/roster",
  requireAccess: fieldDrawAccess.requireAccess,
  database: fieldDrawDatabase,
  storeOptions: { allowedKinds: ["other"] },
});
