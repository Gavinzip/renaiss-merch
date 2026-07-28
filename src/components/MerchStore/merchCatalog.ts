import type { MerchProductId } from '../../lib/merchProducts';

export type { MerchProductId } from '../../lib/merchProducts';

export type MerchProduct = {
  id: MerchProductId;
};

export const merchCatalog: readonly MerchProduct[] = [
  {
    id: 'shirt'
  },
  {
    id: 'bracelet'
  }
];
