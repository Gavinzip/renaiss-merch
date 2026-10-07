import { checkConnection, requestProviderJson } from './request.mjs';

export const X_MISSION_SCOPES = Object.freeze(['tweet.read', 'users.read', 'follows.read']);
const MAX_FOLLOWING_PAGES = 20;

// The lookup API omits connection_status for some valid responses. Use the
// official following list as the sole source of truth, never infer a negative
// from a missing relationship field, and never substitute cached follower data.
export async function verifyXFollow({ connection, targetUserId, expectedUsername, fetchImpl, now = Date.now }) {
  if (typeof targetUserId !== 'string' || !/^\d+$/.test(targetUserId))
    throw new TypeError('A fixed target X user ID is required.');
  const result = value => ({ provider: 'x', targetId: targetUserId, checkedAt: new Date(now()).toISOString(), ...value });
  const connectionError = checkConnection(connection, X_MISSION_SCOPES);
  if (connectionError) return result(connectionError);
  const options = { fetchImpl, now };
  const identity = await requestProviderJson('https://api.x.com/2/users/me?user.fields=username', connection.accessToken, options);
  if (identity.error) return result(identity.error);
  if (identity.body.errors !== undefined || typeof identity.body.data?.id !== 'string')
    return result({ outcome: 'unavailable', reason: 'invalid_identity_response' });
  if (identity.body.data.id !== connection.userId)
    return result({ outcome: 'reauthorize', reason: 'identity_mismatch' });
  if (expectedUsername !== undefined && (!expectedUsername || typeof identity.body.data.username !== 'string' ||
      expectedUsername.replace(/^@/, '').toLowerCase() !== identity.body.data.username.toLowerCase()))
    return result({ outcome: 'reauthorize', reason: expectedUsername ? 'renaiss_x_mismatch' : 'renaiss_x_not_linked' });

  let cursor;
  const cursors = new Set(), startedAt = now();
  for (let page = 1; page <= MAX_FOLLOWING_PAGES; page++) {
    if (now() - startedAt > 60_000) return result({ outcome: 'unavailable', reason: 'following_check_incomplete' });
    const url = new URL(`https://api.x.com/2/users/${connection.userId}/following`);
    url.searchParams.set('max_results', '1000');
    if (cursor) url.searchParams.set('pagination_token', cursor);
    const response = await requestProviderJson(url.href, connection.accessToken, options);
    if (response.error) return result(response.error);
    const body = response.body;
    const rows = body.data === undefined && body.meta?.result_count === 0 ? [] : body.data;
    if (body.errors !== undefined || !Array.isArray(rows) || !rows.every(user => typeof user?.id === 'string' && /^\d+$/.test(user.id)) ||
        !Number.isInteger(body.meta?.result_count) || body.meta.result_count !== rows.length)
      return result({ outcome: 'unavailable', reason: 'invalid_following_response' });
    const next = body.meta.next_token;
    if (next !== undefined && (typeof next !== 'string' || !next || cursors.has(next)))
      return result({ outcome: 'unavailable', reason: 'invalid_following_response' });
    if (rows.some(user => user.id === targetUserId))
      return result({ outcome: 'verified', evidence: { userId: connection.userId, following: true, method: 'following-list', pagesScanned: page } });
    if (next === undefined)
      return result({ outcome: 'incomplete', reason: 'not_following', evidence: { userId: connection.userId, following: false, method: 'following-list', pagesScanned: page } });
    cursor = next; cursors.add(next);
  }
  return result({ outcome: 'unavailable', reason: 'following_check_incomplete' });
}
