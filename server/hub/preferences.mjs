import { validateHubPreferences } from "../../shared/hub-preferences.js";
import { HttpError } from "../http.mjs";
import { getMerchDatabase } from "../merch-database.mjs";

let defaultStore;

export function createHubPreferencesStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS hub_preferences (
    user_sub TEXT PRIMARY KEY,
    preferences_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  const read = db.prepare(
    "SELECT preferences_json FROM hub_preferences WHERE user_sub = ?",
  );
  const write =
    db.prepare(`INSERT INTO hub_preferences (user_sub, preferences_json, updated_at)
    VALUES (?, ?, ?) ON CONFLICT(user_sub) DO UPDATE SET
    preferences_json = excluded.preferences_json, updated_at = excluded.updated_at`);
  return {
    read(session) {
      const row = read.get(identity(session));
      return row
        ? validateHubPreferences(JSON.parse(row.preferences_json))
        : null;
    },
    save(session, payload) {
      const sub = identity(session);
      let preferences;
      try {
        preferences = validateHubPreferences(payload);
      } catch {
        throw new HttpError(400, "invalid_hub_preferences");
      }
      write.run(sub, JSON.stringify(preferences), new Date().toISOString());
      return preferences;
    },
  };
}

function identity(session) {
  const sub = session?.user?.sub;
  if (typeof sub !== "string" || !sub)
    throw new HttpError(401, "authentication_required");
  return sub;
}

export function readHubPreferences(session) {
  identity(session);
  defaultStore ||= createHubPreferencesStore(getMerchDatabase());
  return defaultStore.read(session);
}

export function saveHubPreferences(session, payload) {
  identity(session);
  defaultStore ||= createHubPreferencesStore(getMerchDatabase());
  return defaultStore.save(session, payload);
}
