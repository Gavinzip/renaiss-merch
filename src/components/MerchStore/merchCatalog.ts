import type { MerchProductId } from '../../lib/merchProducts';

export type { MerchProductId } from '../../lib/merchProducts';

export type MerchProduct = {
  dropNumber: string;
  id: MerchProductId;
};

export const merchCatalog: readonly MerchProduct[] = [
  {
    dropNumber: '01',
    id: 'shirt'
  },
  {
    dropNumber: '02',
    id: 'bracelet'
  }
];
