import { randomBytes } from 'node:crypto';
import { getPool, transaction } from './database.mjs';
import { HttpError } from '../http.mjs';

// A callback has no login cookie: its unguessable token binds it to the
// server-created request. Reading/using the result still requires its owner.
export function createSevenElevenStore({ database = getPool() } = {}) {
  const table = 'public.seven_eleven_store_selections';
  const read = async token => (await database.query(
    `SELECT * FROM ${table} WHERE token=$1`, [token])).rows[0];
  return {
    read,
    async create(input) {
      const now = new Date(), token = randomBytes(10).toString('hex');
      await database.query(`DELETE FROM ${table} WHERE selected_at IS NULL AND expires_at<=$1`, [now.toISOString()]);
      await database.query(`INSERT INTO ${table}
        (token,user_sub,context,product_id,return_to,merchant_id,created_at,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [token, input.userSub, input.context,
        input.productId, input.returnTo, input.merchantId, now.toISOString(),
        new Date(now.getTime() + 30 * 60_000).toISOString()]);
      return { token };
    },
    async returned(token, store) {
      return transaction(async client => {
        const row = (await client.query(`SELECT * FROM ${table} WHERE token=$1 FOR UPDATE`, [token])).rows[0];
        if (!row || Date.parse(row.expires_at) <= Date.now())
          throw new HttpError(410, 'seven_eleven_selection_expired');
        if (row.selected_at) {
          if (row.logistics_sub_type !== 'UNIMARTC2C' || row.store_id !== store.id ||
              row.store_name !== store.name || row.store_address !== store.address || row.store_outside !== store.outside)
            throw new HttpError(409, 'seven_eleven_selection_already_returned');
          return;
        }
        await client.query(`UPDATE ${table} SET logistics_sub_type='UNIMARTC2C',
          store_id=$2,store_name=$3,store_address=$4,store_outside=$5,selected_at=$6 WHERE token=$1`,
          [token, store.id, store.name, store.address, store.outside, new Date().toISOString()]);
      }, database);
    },
    async consume(token, sub) {
      await database.query(`UPDATE ${table} SET consumed_at=COALESCE(consumed_at,$3)
        WHERE token=$1 AND user_sub=$2 AND selected_at IS NOT NULL`, [token, sub, new Date().toISOString()]);
    },
  };
}
