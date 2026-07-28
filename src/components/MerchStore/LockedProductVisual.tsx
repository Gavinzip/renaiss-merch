import { staticMerchAssetUrl } from '../../lib/staticAssets';
import type { MerchProductId } from './merchCatalog';

type LockedProductVisualProps = {
  productId: MerchProductId;
  revealedName?: string;
};

export function LockedProductVisual({
  productId,
  revealedName
}: LockedProductVisualProps) {
  const isRevealed = !!revealedName;
  const revealedImageUrl =
    productId === 'bracelet'
      ? '/api/merch-reveal-thumbnail?productId=bracelet&variant=store-cover'
      : `/api/merch-reveal-thumbnail?productId=${productId}`;

  return (
    <img
      alt={revealedName || ''}
      aria-hidden={isRevealed ? undefined : 'true'}
      className={[
        'merch-product-card__locked-media',
        isRevealed ? 'is-revealed' : '',
        isRevealed ? `is-${productId}` : '',
        'is-ready'
      ]
        .filter(Boolean)
        .join(' ')}
      decoding="async"
      loading="eager"
      src={
        isRevealed
          ? revealedImageUrl
          : staticMerchAssetUrl('sealedDrop')
      }
    />
  );
}
