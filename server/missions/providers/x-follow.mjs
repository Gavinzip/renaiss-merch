import { checkConnection, requestProviderJson } from './request.mjs';

export const X_MISSION_SCOPES = Object.freeze(['tweet.read', 'users.read', 'follows.read']);

// A missing relationship field is unknown, not proof that the user does not
// follow Surf. Never fall back to downloading the full following list.
export async function verifyXFollow({ connection, targetUserId, targetHandle, expectedUsername, fetchImpl, now = Date.now }) {
  if (typeof targetUserId !== 'string' || !/^\d+$/.test(targetUserId))
    throw new TypeError('A fixed target X user ID is required.');
  if (typeof targetHandle !== 'string' || !/^[A-Za-z0-9_]{1,15}$/.test(targetHandle))
    throw new TypeError('A fixed target X handle is required.');
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

  const url = new URL(`https://api.x.com/2/users/by/username/${targetHandle}`);
  url.searchParams.set('user.fields', 'connection_status,username');
  const response = await requestProviderJson(url.href, connection.accessToken, options);
  if (response.error) return result(response.error);
  const body = response.body;
  if (body.errors !== undefined || body.data?.id !== targetUserId ||
      typeof body.data?.username !== 'string' || body.data.username.toLowerCase() !== targetHandle.toLowerCase())
    return result({ outcome: 'unavailable', reason: 'invalid_x_target_response' });
  const connectionStatus = body.data.connection_status;
  if (!Array.isArray(connectionStatus) || !connectionStatus.every(status => typeof status === 'string'))
    return result({ outcome: 'unavailable', reason: 'x_relation_unavailable' });
  const following = connectionStatus.includes('following');
  return result({ outcome: following ? 'verified' : 'incomplete',
    ...(following ? {} : { reason: 'not_following' }),
    evidence: { userId: connection.userId, following, method: 'connection-status' } });
}
