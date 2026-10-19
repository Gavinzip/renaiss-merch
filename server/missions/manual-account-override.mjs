import { randomUUID } from 'node:crypto';

// Manual approvals are exceptional, scoped to one campaign, rule and wallet.
// They are separate from Surf's API results so an upstream response remains intact.
export const MANUAL_ACCOUNT_RULE_VERSION = 'surf-accounts-manual-v1';
const walletPattern = /^0x[a-f0-9]{40}$/;
export function createManualAccountOverrideStore(db) {
  const read = async (campaign, userSub) => (await db.prepare(`SELECT wallet_address AS walletAddress, approved_at AS approvedAt
    FROM mission_account_overrides WHERE campaign=? AND rule_version=? AND user_sub=?`).get(campaign, MANUAL_ACCOUNT_RULE_VERSION, userSub)) || null;
  return {
    read,
    async approve({
      campaign,
      userSub,
      walletAddress,
      actor,
      reason
    }) {
      const wallet = String(walletAddress || '').toLowerCase();
      if (!campaign || !userSub || !walletPattern.test(wallet) || !actor?.trim() || !reason?.trim()) throw new Error('A campaign, user, wallet, actor and reason are required.');
      return await db.transaction(async () => {
        if (await read(campaign, userSub)) throw new Error('This user already has a manual account approval.');
        const approvedAt = new Date().toISOString();
        await db.prepare(`INSERT INTO mission_account_overrides VALUES(?,?,?,?,?,?,?)`).run(campaign, MANUAL_ACCOUNT_RULE_VERSION, userSub, wallet, approvedAt, actor.trim(), reason.trim());
        await db.prepare(`INSERT INTO mission_account_override_events VALUES(?,?,?,?,?,?,?,?,?)`).run(randomUUID(), campaign, MANUAL_ACCOUNT_RULE_VERSION, userSub, wallet, 'approved', actor.trim(), reason.trim(), approvedAt);
        return {
          walletAddress: wallet,
          approvedAt
        };
      }).immediate();
    }
  };
}
