import type { MerchProductId } from './merchProducts';

export type MerchProductInventory = {
  claimed: number;
  limit: number;
  productId: MerchProductId;
  remaining: number;
  soldOut: boolean;
};

type MerchInventoryResponse = {
  products: MerchProductInventory[];
};

export async function readMerchInventory(): Promise<
  Partial<Record<MerchProductId, MerchProductInventory>>
> {
  const response = await fetch('/api/merch-inventory', {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Merch inventory endpoint returned ${response.status}.`);
  }

  const body = (await response.json()) as MerchInventoryResponse;

  if (!Array.isArray(body.products)) {
    throw new Error('Merch inventory response is invalid.');
  }

  return Object.fromEntries(
    body.products.map((product) => [product.productId, product])
  );
}
