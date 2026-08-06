import { HttpError, sendJson } from './http.mjs';
import { getMerchDatabase } from './merch-database.mjs';

const productLimits = Object.freeze({
  bracelet: 20
});

export function handleMerchInventory(res, options = {}) {
  sendJson(res, 200, readMerchInventory(options));
}

export function readMerchInventory(options = {}) {
  const database = getMerchDatabase(options.dbPath);

  return {
    products: Object.keys(productLimits).map((productId) =>
      readMerchProductInventory(database, productId)
    )
  };
}

export function readMerchProductInventory(database, productId) {
  const limit = productLimits[productId];

  if (!limit) {
    return null;
  }

  const row = database
    .prepare(
      `
        SELECT COUNT(*) AS claimed
        FROM shipping_claims
        WHERE product_id = @productId
          AND claim_status = 'submitted'
      `
    )
    .get({ productId });
  const claimed = Number(row?.claimed || 0);
  const remaining = Math.max(0, limit - claimed);

  return {
    claimed,
    limit,
    productId,
    remaining,
    soldOut: remaining === 0
  };
}

export function requireMerchProductInventory(database, productId) {
  const inventory = readMerchProductInventory(database, productId);

  if (inventory?.soldOut) {
    throw new HttpError(409, 'merch_inventory_sold_out');
  }

  return inventory;
}
