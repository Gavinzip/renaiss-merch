import Database from 'better-sqlite3';
import { surfCampaign } from '../../shared/surf-campaign.js';
import { getClaimDatabasePath } from '../runtime-config.mjs';
import { createMissionStore } from './store.mjs';
import { readMissionState } from './service.mjs';

// Server-only operator tool. A prior consistent offsite backup is required.
// Usage: node server/missions/approve-account-cli.mjs --wallet 0x... --actor NAME --reason TEXT [--apply]
const args = process.argv.slice(2);
function option(name) {
  const at = args.indexOf(`--${name}`);
  return at < 0 ? null : args[at + 1];
}
const wallet = option('wallet')?.toLowerCase();
const actor = option('actor');
const reason = option('reason');
const apply = args.includes('--apply');
if (!/^0x[a-f0-9]{40}$/.test(wallet || '') || (apply && (!actor?.trim() || !reason?.trim())))
  throw new Error('Provide a valid --wallet; --apply also requires --actor and --reason.');

const db = new Database(getClaimDatabasePath(), { timeout: 5000 });
try {
  const store = createMissionStore(db);
  const rows = db.prepare(`SELECT user_sub, name, wallet_address, tasks_json, ticket_count
    FROM mission_participants WHERE campaign=? AND lower(wallet_address)=?`).all(surfCampaign.id, wallet);
  if (rows.length !== 1) throw new Error('Wallet must identify exactly one existing campaign participant.');
  const participant = rows[0];
  const session = db.prepare(`SELECT user_json FROM renaiss_identity_sessions
    WHERE json_extract(user_json,'$.sub')=? ORDER BY created_at DESC LIMIT 1`).get(participant.user_sub);
  if (!session) throw new Error('No trusted Renaiss identity session exists for this participant.');
  const user = JSON.parse(session.user_json);
  if (user.sub !== participant.user_sub || user.isDemo || user.safeWalletAddress?.toLowerCase() !== wallet)
    throw new Error('The latest Renaiss identity does not match this participant and wallet.');
  if (store.getManualAccountOverride(surfCampaign.id, user.sub))
    throw new Error('This participant already has a manual account approval.');
  const before = JSON.parse(participant.tasks_json);
  if (before.accounts.verified) throw new Error('The first task is already verified.');
  const expectedTickets = 1 + Number(before.x.verified) + Number(before.discord.verified);
  if (!apply) {
    process.stdout.write(JSON.stringify({ dryRun: true, name: participant.name, wallet,
      currentTickets: participant.ticket_count, expectedTickets,
      xVerified: before.x.verified, discordVerified: before.discord.verified }) + '\n');
  } else {
    const req = { headers: { host: new URL(process.env.PUBLIC_APP_ORIGIN).host }, socket: { encrypted: true } };
    const result = db.transaction(() => {
      store.approveManualAccount({ campaign: surfCampaign.id, userSub: user.sub, walletAddress: wallet, actor, reason });
      const state = readMissionState(req, { user }, { storeFactory: () => store });
      const after = state.participation;
      if (!after?.tasks.accounts.verified || after.ticketCount !== expectedTickets ||
          after.tasks.x.verified !== before.x.verified || after.tasks.discord.verified !== before.discord.verified)
        throw new Error('The approval did not produce the expected task and ticket state.');
      return { applied: true, name: after.name, wallet: after.walletAddress,
        accountsVerified: true, xVerified: after.tasks.x.verified,
        discordVerified: after.tasks.discord.verified, tickets: after.ticketCount };
    }).immediate();
    process.stdout.write(JSON.stringify(result) + '\n');
  }
} finally {
  db.close();
}
