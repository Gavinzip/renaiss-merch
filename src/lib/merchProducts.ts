export const MERCH_PRODUCT_IDS = ['shirt', 'bracelet', 'ticket'] as const;

export const PUBLIC_REVEAL_PRODUCT_IDS = [
  'shirt',
  'bracelet',
  'ticket'
] as const;

export type MerchProductId = (typeof MERCH_PRODUCT_IDS)[number];

export const MERCH_PRODUCT_LABELS: Readonly<Record<MerchProductId, string>> = {
  shirt: 'Renaiss Tee',
  bracelet: 'Renaiss Bracelet',
  ticket: 'Flagship Taiwan VIP Ticket'
};

export type PublicRevealProductId =
  (typeof PUBLIC_REVEAL_PRODUCT_IDS)[number];

export function isMerchProductId(value: unknown): value is MerchProductId {
  return (
    typeof value === 'string' &&
    MERCH_PRODUCT_IDS.some((productId) => productId === value)
  );
}

export function hasPublicRevealMedia(
  productId: MerchProductId
): productId is PublicRevealProductId {
  return PUBLIC_REVEAL_PRODUCT_IDS.some(
    (publicProductId) => publicProductId === productId
  );
}
