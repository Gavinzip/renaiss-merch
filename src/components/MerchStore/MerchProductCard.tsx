import { LockedProductVisual } from './LockedProductVisual';
import type { MerchAccessProductState } from '../../lib/merchAccessState';
import type { MerchProduct, MerchProductId } from './merchCatalog';
import type { MerchProductInventory } from '../../lib/merchInventory';
import { MerchInventoryBadge } from './MerchInventoryBadge';
import type { MerchInventoryLoadState } from './useMerchInventory';
import {
  readClaimStatus,
  readMerchProductPresentation
} from './merchProductPresentation';

type MerchProductCardProps = {
  accessState?: MerchAccessProductState;
  disabled: boolean;
  helperText?: string;
  isChecking: boolean;
  inventory?: MerchProductInventory;
  inventoryLoadState: MerchInventoryLoadState;
  onCheck: (productId: MerchProductId) => void;
  product: MerchProduct;
  revealedImageUrl?: string;
};

export function MerchProductCard({
  accessState,
  disabled,
  helperText,
  isChecking,
  inventory,
  inventoryLoadState,
  onCheck,
  product,
  revealedImageUrl
}: MerchProductCardProps) {
  const titleId = `merch-product-${product.id}-title`;
  const helperId = `merch-product-${product.id}-helper`;
  const isEligible = accessState?.status === 'eligible';
  const isUnqualified = accessState?.status === 'unqualified';
  const isSoldOut =
    inventory?.soldOut === true &&
    accessState?.claimStatus !== 'submitted';
  const cardCopy = readMerchProductPresentation(product.id, accessState);

  return (
    <article
      className={[
        'merch-product-card',
        `merch-product-card--${product.id}`,
        isEligible ? 'is-eligible' : '',
        isUnqualified ? 'is-unqualified' : '',
        isChecking ? 'is-checking' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={titleId}
      data-product-id={product.id}
    >
      {cardCopy.headerStatus ? (
        <header className="merch-product-card__header">
          <span>{cardCopy.headerStatus}</span>
        </header>
      ) : null}

      <div
        className="merch-product-card__visual"
        aria-label={
          isEligible
            ? undefined
            : 'This release remains sealed until access is checked.'
        }
        role={isEligible ? undefined : 'img'}
      >
        <LockedProductVisual
          productId={product.id}
          revealedImageUrl={revealedImageUrl}
          revealedName={
            accessState?.status === 'eligible'
              ? cardCopy.title
              : undefined
          }
        />
        <MerchInventoryBadge
          inventory={inventory}
          loadState={inventoryLoadState}
          productId={product.id}
        />
        {cardCopy.visualStatus ? (
          <span className="merch-product-card__lock-label">
            {cardCopy.visualStatus}
          </span>
        ) : null}
      </div>

      <div className="merch-product-card__body">
        <div>
          <h2 id={titleId}>{cardCopy.title}</h2>
          <p className="merch-product-card__description">
            {cardCopy.description}
          </p>
          {isEligible ? (
            <p
              className={`merch-product-card__claim-status merch-product-card__claim-status--${
                accessState.claimStatus || 'not-started'
              }`}
            >
              <span>Claim form</span>
              <strong>{readClaimStatus(accessState.claimStatus)}</strong>
            </p>
          ) : null}
        </div>

        <div className="merch-product-card__access">
          <button
            aria-describedby={helperText ? helperId : undefined}
            disabled={disabled || isSoldOut}
            onClick={() => onCheck(product.id)}
            type="button"
          >
            {isSoldOut
              ? 'Sold out'
              : isChecking
                ? 'Checking'
                : cardCopy.buttonLabel}
          </button>
          {helperText ? <p id={helperId}>{helperText}</p> : null}
        </div>
      </div>
    </article>
  );
}
