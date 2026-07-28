import {
  staticMerchAssetUrl,
  type StaticMerchAsset
} from '../../lib/staticAssets';
import type { MerchProductId } from './merchCatalog';

type LockedProductVisualProps = {
  className?: string;
  productId: MerchProductId;
  revealedName?: string;
  sealedAsset?: Extract<
    StaticMerchAsset,
    'sealedDrop' | 'sealedDropCatalog'
  >;
};

export function LockedProductVisual({
  className,
  productId,
  revealedName,
  sealedAsset = 'sealedDrop'
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
        className || '',
        'is-ready'
      ]
        .filter(Boolean)
        .join(' ')}
      decoding="async"
      loading="eager"
      src={
        isRevealed
          ? revealedImageUrl
          : staticMerchAssetUrl(sealedAsset)
      }
    />
  );
}
