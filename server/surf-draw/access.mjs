import { createDrawRoomAccess } from "../draw-room/access.mjs";
import { authSessionDatabase } from "../auth-session-database.mjs";

const access = createDrawRoomAccess({
  root: "/api/auth/surf-draw",
  cookie: "renaiss_surf_draw_access",
  envPrefix: "SURF_DRAW_ACCESS",
  codePrefix: "surf_draw",
  sessionTable: "surf_draw_access_sessions",
  throttleTable: "surf_draw_login_throttle",
  database: authSessionDatabase,
});
export const surfDrawCredentialFingerprint = access.credentialFingerprint;
export const surfDrawAccessConfigured = access.configured;
export const readSurfDrawAccess = access.read;
export const readSurfDrawAccessHash = access.readHash;
export const authenticateSurfDrawAccess = access.authenticate;
export const issueSurfDrawAccess = access.issue;
export const setSurfDrawAccessCookie = access.setAccessCookie;
export const requireSurfDrawAccess = access.requireAccess;
export const handleSurfDrawAccessRoute = access.handleRoute;

// A dedicated draw-room login authorizes this draw only. It does not grant
// Renaiss SSO or fulfillment permissions.
export function surfDrawOperatorSession(access) {
  return {
    user: {
      sub: `surf-operator:${access.username}`,
      name: access.username,
      isDemo: false,
    },
    expiresAt: access.expiresAt,
  };
}
