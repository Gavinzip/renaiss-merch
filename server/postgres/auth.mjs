import { canManageFulfillment } from "../fulfillment-admin.mjs";
import { HttpError, redirect, sendJson } from "../http.mjs";
import { getAuthConfig, getPublicOrigin } from "../config.mjs";
import {
  SESSION_COOKIE,
  OAUTH_CHALLENGE_COOKIE,
  setCookie,
  clearCookie,
  parseCookies,
} from "../cookies.mjs";
import {
  buildAuthorizationUrl,
  createPkceChallenge,
  discoverIssuer,
  exchangeAuthorizationCode,
  randomToken,
  resolveRenaissIdentity,
} from "../oidc.mjs";
import {
  sessionStore,
  SESSION_SECONDS,
  CHALLENGE_SECONDS,
} from "./sessions.mjs";

export function sameOrigin(req) {
  if (req.headers.origin !== getPublicOrigin(req))
    throw new HttpError(403, "invalid_request_origin");
}
const returnPath = (value) =>
  typeof value === "string" &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.includes("\\")
    ? value
    : "/";
export async function readSession(req) {
  return sessionStore().read(parseCookies(req).get(SESSION_COOKIE));
}

export async function handleAuth(req, res, url) {
  const store = sessionStore();
  if (url.pathname === "/api/auth/demo")
    throw new HttpError(403, "demo_disabled_in_production");
  if (url.pathname === "/api/auth/session") {
    if (req.method !== "GET") throw new HttpError(405, "method_not_allowed");
    const session = await readSession(req);
    sendJson(
      res,
      200,
      session
        ? {
            authenticated: true,
            demoAvailable: false,
            user: { ...session.user, canManageFulfillment: canManageFulfillment(session) },
          }
        : { authenticated: false, demoAvailable: false },
    );
    return true;
  }
  if (url.pathname === "/api/auth/renaiss/start") {
    if (req.method !== "GET") throw new HttpError(405, "method_not_allowed");
    const config = getAuthConfig(req),
      discovery = await discoverIssuer(config.issuer);
    const challenge = {
      ...createPkceChallenge(),
      nonce: randomToken(),
      state: randomToken(),
      redirectUri: config.redirectUri,
      returnTo: returnPath(url.searchParams.get("returnTo")),
    };
    const id = await store.saveChallenge(challenge);
    setCookie(req, res, OAUTH_CHALLENGE_COOKIE, id, {
      maxAge: CHALLENGE_SECONDS,
    });
    redirect(res, buildAuthorizationUrl(discovery, config, challenge));
    return true;
  }
  if (url.pathname === "/auth/callback") {
    if (req.method !== "GET") throw new HttpError(405, "method_not_allowed");
    const challenge = await store.takeChallenge(
      parseCookies(req).get(OAUTH_CHALLENGE_COOKIE),
    );
    clearCookie(req, res, OAUTH_CHALLENGE_COOKIE);
    const code = url.searchParams.get("code");
    if (
      !challenge ||
      !code ||
      challenge.state !== url.searchParams.get("state") ||
      url.searchParams.has("error")
    )
      throw new HttpError(401, "invalid_oauth_state");
    const config = getAuthConfig(req),
      discovery = await discoverIssuer(config.issuer);
    const tokens = await exchangeAuthorizationCode(
      discovery,
      config,
      challenge,
      code,
    );
    const user = await resolveRenaissIdentity(
      discovery,
      config,
      challenge,
      tokens,
    );
    const { id } = await store.create(user);
    setCookie(req, res, SESSION_COOKIE, id, { maxAge: SESSION_SECONDS });
    const target = new URL(returnPath(challenge.returnTo), config.origin);
    target.searchParams.set("auth", "success");
    redirect(res, target.pathname + target.search + target.hash);
    return true;
  }
  if (["/api/auth/logout", "/api/auth/logout-return"].includes(url.pathname)) {
    if (url.pathname.endsWith("logout")) {
      if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
      sameOrigin(req);
    } else if (req.method !== "GET")
      throw new HttpError(405, "method_not_allowed");
    await store.remove(parseCookies(req).get(SESSION_COOKIE));
    clearCookie(req, res, SESSION_COOKIE);
    if (url.pathname.endsWith("logout-return"))
      redirect(res, returnPath(url.searchParams.get("returnTo")));
    else {
      res.writeHead(204, { "Cache-Control": "no-store" });
      res.end();
    }
    return true;
  }
  return false;
}
