import { randomUUID } from 'node:crypto';
import { surfStoreRewards } from '../../shared/surf-store-rewards.js';
import { normalizeSurfStoreEmail } from '../../shared/surf-store-email.js';
import { HttpError } from '../http.mjs';
import { getStorefrontFeatures } from '../storefront-features.mjs';
import { assertSurfStoreOpen } from '../surf-store-release.mjs';
import { readSurfStoreAccess, readSurfStoreReward } from '../surf-store-access.mjs';
import { getPool, sqlTables, transaction } from './database.mjs';
import { identity } from './claims.mjs';

export function normalizeSurfEmail(value) {
  const email = normalizeSurfStoreEmail(value);
  // Preserve the existing API error code and storage field for deployed clients.
  if (!email) throw new HttpError(400, 'surf_gmail_invalid');
  return email;
}

function receipt(row) {
  return row ? { id: row.id, rewardId: row.reward_id, gmail: row.gmail,
    allocationNumber: row.allocation_number, submittedAt: new Date(row.submitted_at).toISOString() } : null;
}

// All limited-product writes share a transaction lock across Vercel instances.
// Unique account/wallet/slot constraints also protect the allocation in PostgreSQL.
export function surfStoreClaims({ database = getPool(), schema = 'public', clock = Date.now,
  readAccess = readSurfStoreAccess, environment = process.env } = {}) {
  const table = sqlTables(schema).surf_store_claims;
  function requireOpen(session, rewardId) {
    if (!getStorefrontFeatures(environment, clock()).surfRewardsVisible) throw new HttpError(404, 'not_found');
    assertSurfStoreOpen(clock());
    const reward = readSurfStoreReward(rewardId);
    const member = identity(session);
    if (session.user.isDemo) throw new HttpError(403, 'surf_demo_forbidden');
    return { reward, ...member };
  }
  async function inventory(client = database) {
    const { rows } = await client.query(`SELECT reward_id, count(*)::integer AS claimed FROM ${table} GROUP BY reward_id`);
    return surfStoreRewards.filter(r => r.status !== 'ended').map(reward => {
      const claimed = rows.find(row => row.reward_id === reward.id)?.claimed ?? 0;
      if (!Number.isSafeInteger(claimed) || claimed < 0 || claimed > reward.plannedQuantity) throw new Error('surf_allocation_invalid');
      return { rewardId: reward.id, limit: reward.plannedQuantity, claimed,
        remaining: reward.plannedQuantity - claimed, soldOut: claimed === reward.plannedQuantity };
    });
  }
  async function findExisting(client, rewardId, sub, wallet) {
    const { rows } = await client.query(`SELECT * FROM ${table} WHERE reward_id=$1 AND (user_sub=$2 OR wallet_address=$3)`, [rewardId, sub, wallet]);
    return rows[0];
  }
  function existingReceipt(row, sub, wallet, gmail) {
    if (row.user_sub !== sub || row.wallet_address !== wallet || row.gmail !== gmail) {
      throw new HttpError(409, 'surf_already_submitted');
    }
    return receipt(row);
  }
  return {
    inventory,
    async read(session, rewardId) {
      const { reward, sub } = requireOpen(session, rewardId);
      // A member still owns their saved receipt after changing wallets.
      const { rows } = await database.query(`SELECT * FROM ${table} WHERE reward_id=$1 AND user_sub=$2`, [reward.id, sub]);
      return { claim: receipt(rows[0]), inventory: (await inventory()).find(row => row.rewardId === reward.id) };
    },
    async submit(session, { rewardId, gmail: input }) {
      const { reward, sub, wallet } = requireOpen(session, rewardId);
      const gmail = normalizeSurfEmail(input);
      const previous = await findExisting(database, reward.id, sub, wallet);
      if (previous) return existingReceipt(previous, sub, wallet, gmail);
      // Check current holdings again on submission; a prior animation check is not a claim proof.
      const proof = await readAccess(session, reward.id, { now: clock(), environment, forceRefresh: true });
      if (proof.walletAddress !== wallet || proof.sbtBadgeCount < reward.minimumSbtBalance) {
        throw new HttpError(403, 'surf_sbt_required');
      }
      return transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`surf-store:${schema}:${reward.id}`]);
        requireOpen(session, reward.id);
        const duplicate = await findExisting(client, reward.id, sub, wallet);
        if (duplicate) return existingReceipt(duplicate, sub, wallet, gmail);
        const stock = (await inventory(client)).find(row => row.rewardId === reward.id);
        if (stock.soldOut) throw new HttpError(409, 'surf_sold_out');
        const { rows } = await client.query(`INSERT INTO ${table}
          (id,reward_id,user_sub,wallet_address,gmail,allocation_number,eligibility_json,submitted_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [randomUUID(), reward.id, sub, wallet, gmail, stock.claimed + 1, JSON.stringify(proof), new Date(clock()).toISOString()]);
        return receipt(rows[0]);
      }, database);
    },
    async list() {
      // Allocation order is authoritative within each product, regardless of
      // small clock differences between independent serverless instances.
      const { rows } = await database.query(`SELECT * FROM ${table} ORDER BY reward_id, allocation_number`);
      return { inventory: await inventory(), claims: rows.map(row => ({ ...receipt(row), userSub: row.user_sub,
        walletAddress: row.wallet_address, sbtBadgeCount: row.eligibility_json.sbtBadgeCount })) };
    },
  };
}
