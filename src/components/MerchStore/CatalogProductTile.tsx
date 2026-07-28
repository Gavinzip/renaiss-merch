import type { MerchAccessProductState } from '../../lib/merchAccessState';
import { LockedProductVisual } from './LockedProductVisual';
import type { MerchProduct, MerchProductId } from './merchCatalog';
import {
  readClaimStatus,
  readMerchProductPresentation
} from './merchProductPresentation';

type CatalogProductTileProps = {
  accessState?: MerchAccessProductState;
  disabled: boolean;
  helperText?: string;
  isChecking: boolean;
  onCheck: (productId: MerchProductId) => void;
  product: MerchProduct;
};

export function CatalogProductTile({
  accessState,
  disabled,
  helperText,
  isChecking,
  onCheck,
  product
}: CatalogProductTileProps) {
  const titleId = `merch-catalog-${product.id}-title`;
  const helperId = `merch-catalog-${product.id}-helper`;
  const isEligible = accessState?.status === 'eligible';
  const isUnqualified = accessState?.status === 'unqualified';
  const presentation = readMerchProductPresentation(accessState);
  const releaseNumber = product.id === 'shirt' ? '01' : '02';

  return (
    <article
      className={[
        'merch-catalog-item',
        `merch-catalog-item--${product.id}`,
        isEligible ? 'is-eligible' : '',
        isUnqualified ? 'is-unqualified' : '',
        isChecking ? 'is-checking' : ''
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
              : 'This release remains sealed until access is checked.'
          }
          role={isEligible ? undefined : 'img'}
        >
          <LockedProductVisual
            className="merch-catalog-item__media"
            productId={product.id}
            sealedAsset="sealedDropCatalog"
            revealedName={
              isEligible ? accessState.reveal.claimName : undefined
            }
          />
          {presentation.headerStatus ? (
            <span className="merch-catalog-item__image-status">
              {presentation.headerStatus}
            </span>
          ) : null}
        </div>

        <div className="merch-catalog-item__rail" aria-hidden="true">
          <span>Release {releaseNumber}</span>
          <strong>
            {isEligible
              ? presentation.category
              : presentation.visualStatus || 'Private drop'}
          </strong>
        </div>
      </div>

      <div className="merch-catalog-item__body">
        <p className="merch-catalog-item__category">
          Release {releaseNumber} / {presentation.category}
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
            <span>Claim form</span>
            <strong>{readClaimStatus(accessState.claimStatus)}</strong>
          </p>
        ) : null}

        <div className="merch-catalog-item__access">
          <button
            aria-describedby={helperText ? helperId : undefined}
            disabled={disabled}
            onClick={() => onCheck(product.id)}
            type="button"
          >
            <span>{isChecking ? 'Checking' : presentation.buttonLabel}</span>
          </button>
          {helperText ? <p id={helperId}>{helperText}</p> : null}
        </div>
      </div>
    </article>
  );
}
