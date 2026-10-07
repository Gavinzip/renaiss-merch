// Temporary launch control. Remove this switch when Surf rewards formally open,
// independently of the date the new home becomes the public entry.
export function getStorefrontFeatures(environment = process.env) {
  const value = environment.MERCH_SURF_REWARDS_VISIBLE?.trim();
  if (value !== undefined && value !== 'true' && value !== 'false') {
    throw new Error('MERCH_SURF_REWARDS_VISIBLE must be true or false.');
  }
  return { surfRewardsVisible: value === 'true' };
}
