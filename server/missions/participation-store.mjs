import { randomUUID } from 'node:crypto';
import { getMerchDatabase } from '../merch-database.mjs';

export const TICKET_RULE_VERSION = 'surf-tickets-v1';
const walletPattern = /^0x[a-fA-F0-9]{40}$/;

// Verification freshness and recorded raffle tickets have different lifetimes.
// A cached check expiring is not evidence that a participant failed a task.
export function createParticipationStore(db = getMerchDatabase()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mission_participants (
      campaign TEXT NOT NULL, rule_version TEXT NOT NULL, user_sub TEXT NOT NULL,
      name TEXT, wallet_address TEXT, email TEXT, renaiss_x_username TEXT,
      x_user_id TEXT, x_username TEXT, discord_user_id TEXT, discord_username TEXT,
      tasks_json TEXT NOT NULL, ticket_count INTEGER NOT NULL CHECK(ticket_count BETWEEN 0 AND 3),
      status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(campaign,rule_version,user_sub)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS mission_participants_ticket_wallet
      ON mission_participants(campaign,rule_version,wallet_address)
      WHERE ticket_count > 0 AND wallet_address IS NOT NULL;
    CREATE TABLE IF NOT EXISTS mission_participation_events (
      id TEXT PRIMARY KEY, campaign TEXT NOT NULL, rule_version TEXT NOT NULL, user_sub TEXT NOT NULL,
      previous_json TEXT, next_json TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mission_participant_exports (
      id TEXT PRIMARY KEY, campaign TEXT NOT NULL, rule_version TEXT NOT NULL,
      created_by TEXT NOT NULL, scope TEXT NOT NULL, participant_count INTEGER NOT NULL,
      ticket_count INTEGER NOT NULL, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL
    );
  `);

  function read(campaign, sub) {
    const row = db.prepare('SELECT * FROM mission_participants WHERE campaign=? AND rule_version=? AND user_sub=?')
      .get(campaign, TICKET_RULE_VERSION, sub);
    return row ? publicParticipant(row) : null;
  }

  return {
    database: db,
    read,
    sync(campaign, user, accounts, providers) {
      if (!user?.sub || user.isDemo) return null;
      return db.transaction(() => {
        const previous = read(campaign, user.sub);
        const wallet = typeof user.safeWalletAddress === 'string' && walletPattern.test(user.safeWalletAddress)
          ? user.safeWalletAddress.toLowerCase() : null;
        const tasks = {
          accounts: recordTask(accounts, accounts.email || user.email || null, previous?.tasks.accounts),
          x: recordTask(providers.x.result, providers.x.connection?.userId || null, previous?.tasks.x),
          discord: recordTask(providers.discord.result, providers.discord.connection?.userId || null, previous?.tasks.discord),
        };
        const verifiedCount = Object.values(tasks).filter(task => task.verified).length;
        let ticketCount = wallet && tasks.accounts.verified ? verifiedCount : 0;
        let status = !wallet ? 'wallet_required' : !tasks.accounts.verified ? 'accounts_required' : 'eligible';
        if (ticketCount && db.prepare(`SELECT user_sub FROM mission_participants
          WHERE campaign=? AND rule_version=? AND wallet_address=? AND user_sub<>? AND ticket_count>0`)
          .get(campaign, TICKET_RULE_VERSION, wallet, user.sub)) {
          ticketCount = 0;
          status = 'wallet_already_registered';
        }
        const now = new Date().toISOString();
        const next = {
          campaignId: campaign, ruleVersion: TICKET_RULE_VERSION, userSub: user.sub,
          name: user.name || null, walletAddress: wallet, email: user.email || null,
          renaissXUsername: user.twitterUsername || null,
          xUserId: providers.x.connection?.userId || null, xUsername: providers.x.connection?.username || null,
          discordUserId: providers.discord.connection?.userId || null, discordUsername: providers.discord.connection?.username || null,
          tasks, ticketCount, status, createdAt: previous?.createdAt || now,
        };
        const { updatedAt: _updated, ...before } = previous || {};
        if (previous && JSON.stringify(before) === JSON.stringify(next)) return previous;
        db.prepare(`INSERT INTO mission_participants VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(campaign,rule_version,user_sub) DO UPDATE SET name=excluded.name,wallet_address=excluded.wallet_address,
          email=excluded.email,renaiss_x_username=excluded.renaiss_x_username,x_user_id=excluded.x_user_id,
          x_username=excluded.x_username,discord_user_id=excluded.discord_user_id,discord_username=excluded.discord_username,
          tasks_json=excluded.tasks_json,ticket_count=excluded.ticket_count,status=excluded.status,updated_at=excluded.updated_at`)
          .run(campaign, TICKET_RULE_VERSION, user.sub, next.name, wallet, next.email, next.renaissXUsername,
            next.xUserId, next.xUsername, next.discordUserId, next.discordUsername, JSON.stringify(tasks),
            ticketCount, status, next.createdAt, now);
        const recorded = { ...next, updatedAt: now };
        db.prepare('INSERT INTO mission_participation_events VALUES(?,?,?,?,?,?,?)')
          .run(randomUUID(), campaign, TICKET_RULE_VERSION, user.sub, previous ? JSON.stringify(previous) : null, JSON.stringify(recorded), now);
        return recorded;
      }).immediate();
    },
  };
}

function recordTask(result, identity, previous) {
  const outcome = result?.outcome || 'pending';
  const identityMatches = Boolean(identity) && previous?.identity === identity;
  // Provider/network/authorization errors do not prove an unfollow or departure.
  // Preserve the recorded pass and expose the failed recheck. A confirmed
  // failure, changed identity, disconnection or changed policy revokes it.
  const identityInvalid = ['identity_mismatch', 'renaiss_x_mismatch', 'renaiss_x_not_linked', 'x_verified_account_locked', 'discord_verified_account_locked', 'discord_target_mismatch'].includes(result?.reason);
  const retained = !identityInvalid && identityMatches && previous?.verified && ['unavailable', 'reauthorize'].includes(outcome);
  const verified = Boolean(identity) && (outcome === 'verified' || retained);
  return {
    verified,
    identity,
    verifiedAt: verified ? outcome === 'verified' ? result.checkedAt : previous.verifiedAt : null,
    checkedAt: result?.checkedAt || null,
    outcome,
    reason: result?.reason || null,
  };
}

export function publicParticipant(row) {
  return {
    campaignId: row.campaign, ruleVersion: row.rule_version, userSub: row.user_sub,
    name: row.name, walletAddress: row.wallet_address, email: row.email, renaissXUsername: row.renaiss_x_username,
    xUserId: row.x_user_id, xUsername: row.x_username, discordUserId: row.discord_user_id, discordUsername: row.discord_username,
    tasks: JSON.parse(row.tasks_json), ticketCount: row.ticket_count, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
