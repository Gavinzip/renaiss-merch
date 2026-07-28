import { LockedProductVisual } from './LockedProductVisual';
import {
  getVerifiedSbtCount
} from '../../lib/merchEligibility';
import type { MerchAccessProductState } from '../../lib/merchAccessState';
import type { MerchProduct, MerchProductId } from './merchCatalog';

type MerchProductCardProps = {
  accessState?: MerchAccessProductState;
  disabled: boolean;
  helperText?: string;
  isChecking: boolean;
  onCheck: (productId: MerchProductId) => void;
  product: MerchProduct;
};

export function MerchProductCard({
  accessState,
  disabled,
  helperText,
  isChecking,
  onCheck,
  product
}: MerchProductCardProps) {
  const titleId = `merch-product-${product.id}-title`;
  const helperId = `merch-product-${product.id}-helper`;
  const isEligible = accessState?.status === 'eligible';
  const isUnqualified = accessState?.status === 'unqualified';
  const verifiedSbtCount = accessState
    ? getVerifiedSbtCount(accessState)
    : null;
  const minimumSbtBalance = accessState?.minimumSbtBalance ?? null;
  const missingSbt =
    verifiedSbtCount !== null && minimumSbtBalance !== null
      ? Math.max(0, minimumSbtBalance - verifiedSbtCount)
      : null;
  const cardCopy = readCardCopy(
    accessState,
    verifiedSbtCount,
    minimumSbtBalance,
    missingSbt
  );

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
    >
      <header className="merch-product-card__header">
        <p>Drop {product.dropNumber}</p>
        <span>{cardCopy.headerStatus}</span>
      </header>

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
          revealedName={
            accessState?.status === 'eligible'
              ? accessState.reveal.claimName
              : undefined
          }
        />
        <span className="merch-product-card__lock-label">
          {cardCopy.visualStatus}
        </span>
      </div>

      <div className="merch-product-card__body">
        <div>
          <p className="merch-product-card__category">{cardCopy.category}</p>
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
            disabled={disabled}
            onClick={() => onCheck(product.id)}
            type="button"
          >
            {isChecking ? 'Checking' : cardCopy.buttonLabel}
          </button>
          {helperText ? <p id={helperId}>{helperText}</p> : null}
        </div>
      </div>
    </article>
  );
}

function readCardCopy(
  accessState: MerchAccessProductState | undefined,
  verifiedSbtCount: number | null,
  minimumSbtBalance: number | null,
  missingSbt: number | null
) {
  if (accessState?.status === 'eligible') {
    return {
      buttonLabel: 'View item',
      category: accessState.reveal.category,
      description: `${accessState.reveal.description} ${minimumSbtBalance} SBT access requirement met.`,
      headerStatus: 'Revealed',
      title: accessState.reveal.claimName,
      visualStatus: 'Access granted'
    };
  }

  if (
    accessState?.status === 'unqualified' &&
    verifiedSbtCount !== null &&
    minimumSbtBalance !== null &&
    missingSbt !== null
  ) {
    return {
      buttonLabel: 'Check again',
      category: 'Access not met',
      description: `${missingSbt} more SBT required to reveal this release.`,
      headerStatus: 'Not eligible',
      title: `${verifiedSbtCount} / ${minimumSbtBalance} SBT`,
      visualStatus: `${verifiedSbtCount} / ${minimumSbtBalance} SBT`
    };
  }

  return {
    buttonLabel: 'Check access',
    category: 'Private drop',
    description: 'All release details stay sealed until your first access check.',
    headerStatus: 'Sealed',
    title: 'Sealed edition',
    visualStatus: 'Access required'
  };
}

function readClaimStatus(status: MerchAccessProductState['claimStatus']) {
  switch (status) {
    case 'submitted':
      return 'Submitted';
    case 'draft':
      return 'Draft saved';
    default:
      return 'Not started';
  }
}
