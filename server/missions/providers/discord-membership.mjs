import { checkConnection, requestProviderJson } from "./request.mjs";

export const DISCORD_MISSION_SCOPES = Object.freeze(["identify", "guilds.members.read"]);

// `connection` comes from the server's authenticated connection store, never
// from request JSON. Screening is an explicit campaign rule, not an implicit
// interpretation of "Join Discord". No bot or guilds.join permission is used.
export async function verifyDiscordMembership({ connection, guildId, inviteUrl, requireScreening, fetchImpl, now = Date.now }) {
  if (typeof guildId !== "string" || !/^\d+$/.test(guildId) || typeof requireScreening !== "boolean")
    throw new TypeError("A fixed guild ID and explicit screening policy are required.");
  const result = (value) => ({ provider: "discord", targetId: guildId, checkedAt: new Date(now()).toISOString(), ...value });
  const connectionError = checkConnection(connection, DISCORD_MISSION_SCOPES);
  if (connectionError) return result(connectionError);
  const options = { fetchImpl, now };
  const identity = await requestProviderJson("https://discord.com/api/v10/users/@me", connection.accessToken, options);
  if (identity.error) return result(identity.error);
  if (typeof identity.body.id !== "string" || !/^\d+$/.test(identity.body.id))
    return result({ outcome: "unavailable", reason: "invalid_identity_response" });
  if (identity.body.id !== connection.userId || identity.body.bot === true)
    return result({ outcome: "reauthorize", reason: "identity_mismatch" });
  const membership = await requestProviderJson(
    `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, connection.accessToken, options,
  );
  if (membership.status === 404 && membership.body?.code === 10007)
    return result({ outcome: "incomplete", reason: "not_a_member" });
  if (membership.status === 404 && membership.body?.code === 10004) {
    // Live user OAuth returns Unknown Guild for a non-member. That code alone
    // could also mean a bad target, so independently confirm the campaign's
    // public invite still names this guild before interpreting the absence.
    const target = await confirmInviteTarget(inviteUrl, guildId, options);
    if (target.error) return result(target.error);
    return result({ outcome: "incomplete", reason: "not_a_member", evidence: { member: false, targetConfirmed: true } });
  }
  if (membership.error) return result(membership.error);
  const member = membership.body;
  if (member.user?.id !== connection.userId || typeof member.joined_at !== "string" || !Number.isFinite(Date.parse(member.joined_at)))
    return result({ outcome: "unavailable", reason: "invalid_membership_response" });
  if (member.pending !== undefined && typeof member.pending !== "boolean")
    return result({ outcome: "unavailable", reason: "invalid_membership_response" });
  const evidence = { member: true, userId: connection.userId, joinedAt: member.joined_at, screeningPending: member.pending ?? null };
  if (requireScreening && member.pending === true)
    return result({ outcome: "pending", reason: "membership_screening_pending", evidence });
  if (requireScreening && member.pending === undefined)
    return result({ outcome: "unavailable", reason: "screening_status_unavailable", evidence });
  return result({ outcome: "verified", evidence });
}

async function confirmInviteTarget(inviteUrl, guildId, options) {
  let invite;
  try { invite = new URL(inviteUrl); } catch { return { error: { outcome: "unavailable", reason: "discord_target_unconfirmed" } }; }
  if (invite.origin !== "https://discord.gg" || !/^\/[A-Za-z0-9-]+$/.test(invite.pathname) || invite.search || invite.hash)
    return { error: { outcome: "unavailable", reason: "discord_target_unconfirmed" } };
  const target = await requestProviderJson(`https://discord.com/api/v10/invites${invite.pathname}`, null, options);
  if (target.error) return target;
  if (target.body.guild?.id !== guildId)
    return { error: { outcome: "unavailable", reason: "discord_target_mismatch" } };
  return target;
}
