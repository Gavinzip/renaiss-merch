export const MERCH_PRODUCT_IDS = ['shirt', 'bracelet'] as const;

export type MerchProductId = (typeof MERCH_PRODUCT_IDS)[number];

export function isMerchProductId(value: unknown): value is MerchProductId {
  return (
    typeof value === 'string' &&
    MERCH_PRODUCT_IDS.some((productId) => productId === value)
  );
}
