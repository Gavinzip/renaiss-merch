import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { parseCookies, setCookie, clearCookie } from "../cookies.mjs";
import { getPublicOrigin } from "../config.mjs";
import { HttpError, sendJson } from "../http.mjs";
import { sessionIdHash } from "../auth-session-database.mjs";
import { readJsonBody } from "../shipping-details.mjs";
import {
  parseSurfDrawPasswordHash,
  verifySurfDrawPassword,
} from "../surf-draw/access-credential.mjs";

const SESSION_SECONDS = 12 * 60 * 60;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;
// Room settings are internal dependencies, never request input.
export function createDrawRoomAccess({
  root: ROOT,
  cookie: COOKIE,
  envPrefix,
  codePrefix,
  sessionTable,
  throttleTable,
  database,
  fingerprintScope = "",
}) {
  if (
    ![sessionTable, throttleTable].every((name) =>
      /^[a-z_][a-z0-9_]*$/.test(name),
    )
  )
    throw new Error("invalid_auth_table");
  function configuration() {
    const username = process.env[`${envPrefix}_USERNAME`]?.trim();
    const hash = process.env[`${envPrefix}_PASSWORD_HASH`]?.trim();
    if (!username && !hash) return null;
    if (!USERNAME_PATTERN.test(username || "") || !hash)
      throw new HttpError(503, `${codePrefix}_access_config_invalid`);
    const parsed = parseSurfDrawPasswordHash(hash);
    if (!parsed)
      throw new HttpError(503, `${codePrefix}_access_config_invalid`);
    return {
      username,
      parsed,
      fingerprint: createHash("sha256")
        .update(`${fingerprintScope}${username}:${hash}`)
        .digest("hex"),
    };
  }
  const credentialFingerprint = () => configuration()?.fingerprint || null;
  const configured = () => Boolean(configuration());
  async function read(req) {
    const id = parseCookies(req).get(COOKIE);
    if (!id || id.length > 128) return null;
    return await readHash(sessionIdHash(id));
  }
  async function readHash(idHash, db = database()) {
    const config = configuration();
    if (!config) return null;
    const session = await db
      .prepare(
        `SELECT username,credential_fingerprint,expires_at FROM ${sessionTable} WHERE id_hash=?`,
      )
      .get(idHash);
    if (!session) return null;
    if (
      session.expires_at <= Date.now() ||
      session.credential_fingerprint !== config.fingerprint
    ) {
      await db
        .prepare(`DELETE FROM ${sessionTable} WHERE id_hash=?`)
        .run(idHash);
      return null;
    }
    return {
      username: session.username,
      expiresAt: session.expires_at,
    };
  }

  async function authenticate(req, body, db = database()) {
    const config = configuration();
    if (!config)
      throw new HttpError(503, `${codePrefix}_access_not_configured`);
    const username =
      typeof body?.username === "string" && body.username.length <= 64
        ? body.username
        : "";
    const password =
      typeof body?.password === "string" && body.password.length <= 256
        ? body.password
        : "";
    const addressHash = clientAddressHash(req),
      now = Date.now();
    await db
      .transaction(async () => {
        const throttle = await db
          .prepare(`SELECT * FROM ${throttleTable} WHERE address_hash=?`)
          .get(addressHash);
        if (throttle?.locked_until > now)
          throw new HttpError(429, `${codePrefix}_login_rate_limited`);
        const withinWindow =
          throttle && now - throttle.window_start < WINDOW_MS;
        const failures = withinWindow ? throttle.failures + 1 : 1;
        await db
          .prepare(
            `INSERT INTO ${throttleTable} (address_hash,failures,window_start,locked_until) VALUES(?,?,?,?)
      ON CONFLICT(address_hash) DO UPDATE SET failures=excluded.failures,window_start=excluded.window_start,locked_until=excluded.locked_until`,
          )
          .run(
            addressHash,
            failures,
            withinWindow ? throttle.window_start : now,
            failures >= MAX_FAILURES ? now + WINDOW_MS : 0,
          );
      })
      .immediate();
    const userMatch = safeEqual(username, config.username);
    const passwordMatch = await verifySurfDrawPassword(password, config.parsed);
    if (!userMatch || !passwordMatch)
      throw new HttpError(401, `${codePrefix}_invalid_credentials`);
    await db
      .prepare(`DELETE FROM ${throttleTable} WHERE address_hash=?`)
      .run(addressHash);
    return {
      username: config.username,
      fingerprint: config.fingerprint,
    };
  }
  async function issue(identity, db = database()) {
    const username =
      typeof identity === "string" ? identity : identity.username;
    const config = configuration();
    if (!config || username !== config.username)
      throw new HttpError(503, `${codePrefix}_access_config_invalid`);
    if (
      typeof identity !== "string" &&
      identity.fingerprint !== config.fingerprint
    )
      throw new HttpError(401, `${codePrefix}_invalid_credentials`);
    const token = randomBytes(32).toString("base64url"),
      expiresAt = Date.now() + SESSION_SECONDS * 1000;
    await db
      .prepare(`DELETE FROM ${sessionTable} WHERE expires_at<=?`)
      .run(Date.now());
    await db
      .prepare(`INSERT INTO ${sessionTable} VALUES(?,?,?,?)`)
      .run(sessionIdHash(token), username, config.fingerprint, expiresAt);
    return {
      token,
      username,
      expiresAt,
    };
  }
  function setAccessCookie(req, res, session) {
    setCookie(req, res, COOKIE, session.token, {
      maxAge: SESSION_SECONDS,
    });
  }
  async function requireAccess(req) {
    if (!configuration())
      throw new HttpError(503, `${codePrefix}_access_not_configured`);
    const access = await read(req);
    if (!access) throw new HttpError(401, `${codePrefix}_access_required`);
    return access;
  }
  async function handleRoute(req, res, url) {
    if (url.pathname === `${ROOT}/session`) {
      requireMethod(req, "GET");
      const config = configuration();
      const access = config ? await read(req) : null;
      sendJson(res, 200, {
        configured: Boolean(config),
        authenticated: Boolean(access),
        username: access?.username ?? null,
      });
      return true;
    }
    if (url.pathname === `${ROOT}/login`) {
      requireMethod(req, "POST");
      requireOrigin(req);
      const identity = await authenticate(req, await readJsonBody(req));
      const session = await issue(identity);
      setAccessCookie(req, res, session);
      sendJson(res, 200, {
        authenticated: true,
        username: session.username,
      });
      return true;
    }
    if (url.pathname === `${ROOT}/logout`) {
      requireMethod(req, "POST");
      requireOrigin(req);
      const id = parseCookies(req).get(COOKIE);
      if (id && id.length <= 128)
        await database()
          .prepare(`DELETE FROM ${sessionTable} WHERE id_hash=?`)
          .run(sessionIdHash(id));
      clearCookie(req, res, COOKIE);
      sendJson(res, 200, {
        authenticated: false,
      });
      return true;
    }
    return false;
  }
  function safeEqual(a, b) {
    const left = createHash("sha256").update(a).digest(),
      right = createHash("sha256").update(b).digest();
    return timingSafeEqual(left, right);
  }
  function clientAddressHash(req) {
    return createHash("sha256")
      .update(req.socket.remoteAddress || "unknown")
      .digest("hex");
  }
  function requireMethod(req, method) {
    if (req.method !== method) throw new HttpError(405, "method_not_allowed");
  }
  function requireOrigin(req) {
    if (req.headers.origin !== getPublicOrigin(req))
      throw new HttpError(403, "invalid_request_origin");
  }

  return {
    credentialFingerprint,
    configured,
    read,
    readHash,
    authenticate,
    issue,
    setAccessCookie,
    requireAccess,
    handleRoute,
  };
}
