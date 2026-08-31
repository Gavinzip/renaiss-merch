import type { MerchAccessProductState } from '../../lib/merchAccessState';
import type { MerchProductInventory } from '../../lib/merchInventory';
import { LockedProductVisual } from './LockedProductVisual';
import { MerchInventoryBadge } from './MerchInventoryBadge';
import type { MerchProduct, MerchProductId } from './merchCatalog';
import {
  readClaimStatus,
  readMerchProductPresentation
} from './merchProductPresentation';
import {
  ProductPreparationLabel,
  type ProductPreparationPhase
} from './ProductPreparationLabel';
import type { MerchInventoryLoadState } from './useMerchInventory';
import { useLocale } from '../../i18n/LocaleContext';

type CatalogProductTileProps = {
  accessState?: MerchAccessProductState;
  disabled: boolean;
  helperText?: string;
  inventory?: MerchProductInventory;
  inventoryLoadState: MerchInventoryLoadState;
  onCheck: (productId: MerchProductId) => void;
  preparationPhase?: ProductPreparationPhase;
  preparationPercent?: number;
  product: MerchProduct;
  revealedImageUrl?: string;
};

export function CatalogProductTile({
  accessState,
  disabled,
  helperText,
  inventory,
  inventoryLoadState,
  onCheck,
  preparationPhase,
  preparationPercent,
  product,
  revealedImageUrl
}: CatalogProductTileProps) {
  const { locale } = useLocale();
  const copy = catalogCopy[locale];
  const titleId = `merch-catalog-${product.id}-title`;
  const helperId = `merch-catalog-${product.id}-helper`;
  const isEligible = accessState?.status === 'eligible';
  const isUnqualified = accessState?.status === 'unqualified';
  const isSoldOut =
    inventory?.soldOut === true &&
    accessState?.claimStatus !== 'submitted';
  const presentation = readMerchProductPresentation(
    product.id,
    locale,
    accessState
  );
  const releaseNumber =
    product.id === 'shirt' ? '01' : product.id === 'bracelet' ? '02' : '03';

  return (
    <article
      className={[
        'merch-catalog-item',
        `merch-catalog-item--${product.id}`,
        isEligible ? 'is-eligible' : '',
        isUnqualified ? 'is-unqualified' : '',
        preparationPhase ? `is-${preparationPhase}` : ''
      ]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={titleId}
      data-product-id={product.id}
    >
      <div className="merch-catalog-item__visual-shell">
        <div
          className="merch-catalog-item__visual"
          aria-label={
            isEligible
              ? undefined
              : copy.sealedAria
          }
          role={isEligible ? undefined : 'img'}
        >
          <LockedProductVisual
            className="merch-catalog-item__media"
            productId={product.id}
            sealedAsset={
              product.id === 'bracelet'
                ? 'braceletSealedDrop'
                : product.id === 'ticket'
                  ? 'ticketSealedDrop'
                  : 'sealedDropCatalog'
            }
            revealedImageUrl={revealedImageUrl}
            revealedName={
              isEligible ? presentation.title : undefined
            }
          />
          <MerchInventoryBadge
            inventory={inventory}
            loadState={inventoryLoadState}
            productId={product.id}
            variant="catalog"
          />
          {presentation.headerStatus ? (
            <span className="merch-catalog-item__image-status">
              {presentation.headerStatus}
            </span>
          ) : null}
        </div>

        <div className="merch-catalog-item__rail" aria-hidden="true">
          <span>{copy.release} {releaseNumber}</span>
          <strong>
            {isEligible
              ? presentation.category
              : presentation.visualStatus || copy.privateDrop}
          </strong>
        </div>
      </div>

      <div className="merch-catalog-item__body">
        <p className="merch-catalog-item__category">
          {copy.release} {releaseNumber} / {presentation.category}
        </p>
        <h2 id={titleId}>{presentation.title}</h2>
        <p className="merch-catalog-item__description">
          {presentation.description}
        </p>

        {isEligible ? (
          <p
            className={`merch-catalog-item__claim-status merch-catalog-item__claim-status--${
              accessState.claimStatus || 'not-started'
            }`}
          >
            <span>{copy.claimForm}</span>
            <strong>{readClaimStatus(accessState.claimStatus, locale)}</strong>
          </p>
        ) : null}

        <div className="merch-catalog-item__access">
          <button
            aria-describedby={helperText ? helperId : undefined}
            disabled={disabled || isSoldOut}
            onClick={() => onCheck(product.id)}
            type="button"
          >
            {isSoldOut ? (
              <span>{copy.soldOut}</span>
            ) : preparationPhase ? (
              <ProductPreparationLabel
                percent={preparationPercent}
                phase={preparationPhase}
              />
            ) : (
              <span>{presentation.buttonLabel}</span>
            )}
          </button>
          {helperText ? <p id={helperId}>{helperText}</p> : null}
        </div>
      </div>
    </article>
  );
}

const catalogCopy = {
  en: {
    claimForm: 'Claim form',
    privateDrop: 'Private drop',
    release: 'Release',
    sealedAria: 'This release remains sealed until access is checked.',
    soldOut: 'Sold out'
  },
  'zh-TW': {
    claimForm: '領取表單',
    privateDrop: '限定發行',
    release: '系列',
    sealedAria: '此商品會保持封存，直到完成資格檢查。',
    soldOut: '已全數領取'
  }
} as const;
