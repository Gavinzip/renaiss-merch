import {
  staticMerchAssetUrl,
  type StaticMerchAsset
} from '../../lib/staticAssets';
import type { MerchProductId } from './merchCatalog';

type LockedProductVisualProps = {
  className?: string;
  productId: MerchProductId;
  revealedImageUrl?: string;
  revealedName?: string;
  sealedAsset?: Extract<
    StaticMerchAsset,
    'braceletSealedDrop' | 'sealedDrop' | 'sealedDropCatalog'
  >;
};

export function LockedProductVisual({
  className,
  productId,
  revealedImageUrl,
  revealedName,
  sealedAsset
}: LockedProductVisualProps) {
  const isRevealed = !!revealedName && !!revealedImageUrl;
  const lockedAsset =
    sealedAsset ??
    (productId === 'bracelet' ? 'braceletSealedDrop' : 'sealedDrop');

  return (
    <>
      <img
        alt=""
        aria-hidden="true"
        className={[
          'merch-product-card__locked-media',
          'is-unrevealed',
          isRevealed ? 'is-placeholder' : '',
          className || '',
          'is-ready'
        ]
          .filter(Boolean)
          .join(' ')}
        decoding="async"
        loading="eager"
        src={staticMerchAssetUrl(lockedAsset)}
      />
      {isRevealed ? (
        <img
          alt={revealedName}
          className={[
            'merch-product-card__locked-media',
            'is-revealed',
            `is-${productId}`,
            className || '',
            'is-ready'
          ]
            .filter(Boolean)
            .join(' ')}
          decoding="async"
          loading="eager"
          src={revealedImageUrl}
        />
      ) : null}
    </>
  );
}
