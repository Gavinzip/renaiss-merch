// A provider failure is not negative evidence. Return only safe, structured
// reasons; raw provider bodies and access tokens must never reach the browser.
export async function requestProviderJson(url, accessToken, { fetchImpl = fetch, now = Date.now } = {}) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
  } catch {
    return { error: { outcome: "unavailable", reason: "provider_unreachable" } };
  }
  const retrySeconds = readRetrySeconds(response.headers.get("retry-after"), now());
  if (response.status === 401) return { error: { outcome: "reauthorize", reason: "authorization_expired" } };
  if (response.status === 429) return { error: {
    outcome: "unavailable", reason: "provider_rate_limited",
    ...(retrySeconds === null ? {} : { retryAfterSeconds: retrySeconds }),
  } };
  let body;
  try { body = await response.json(); }
  catch { return { error: { outcome: "unavailable", reason: "invalid_provider_response" } }; }
  // Discord's specific absence codes are handled by its own verifier.
  if (!response.ok) return { status: response.status, body,
    error: { outcome: "unavailable", reason: response.status === 403 ? "provider_access_denied" : "provider_error" } };
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { error: { outcome: "unavailable", reason: "invalid_provider_response" } };
  return { status: response.status, body };
}

export function checkConnection(connection, requiredScopes) {
  if (!connection || typeof connection.accessToken !== "string" || !connection.accessToken ||
      typeof connection.userId !== "string" || !/^\d+$/.test(connection.userId))
    return { outcome: "reauthorize", reason: "connection_required" };
  if (!Array.isArray(connection.scopes) || !requiredScopes.every((scope) => connection.scopes.includes(scope)))
    return { outcome: "reauthorize", reason: "permission_required" };
  return null;
}

export function readRetrySeconds(value, timestamp) {
  if (!value) return null;
  const seconds = /^\d+(\.\d+)?$/.test(value) ? Number(value) : (Date.parse(value) - timestamp) / 1000;
  return Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : null;
}
