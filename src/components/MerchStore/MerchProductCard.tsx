import { LockedProductVisual } from './LockedProductVisual';
import type { MerchAccessProductState } from '../../lib/merchAccessState';
import type { MerchProduct, MerchProductId } from './merchCatalog';
import type { MerchProductInventory } from '../../lib/merchInventory';
import { MerchInventoryBadge } from './MerchInventoryBadge';
import type { MerchInventoryLoadState } from './useMerchInventory';
import {
  readClaimStatus,
  readMerchProductDescription,
  readMerchProductPresentation
} from './merchProductPresentation';
import {
  ProductPreparationLabel,
  type ProductPreparationPhase
} from './ProductPreparationLabel';
import { useLocale } from '../../i18n/LocaleContext';
import { StoreReleaseStatus } from './StoreReleaseStatus';

type MerchProductCardProps = {
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

export function MerchProductCard({
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
}: MerchProductCardProps) {
  const { locale } = useLocale();
  const copy = cardCopyByLocale[locale];
  const titleId = `merch-product-${product.id}-title`;
  const helperId = `merch-product-${product.id}-helper`;
  const isEligible = accessState?.status === 'eligible';
  const isUnqualified = accessState?.status === 'unqualified';
  const isRetired = inventory?.soldOut === true;
  const isSoldOut =
    isRetired &&
    accessState?.claimStatus !== 'submitted';
  const cardCopy = readMerchProductPresentation(
    product.id,
    locale,
    accessState
  );

  return (
    <article
      className={[
        'merch-product-card',
        `merch-product-card--${product.id}`,
        isEligible ? 'is-eligible' : '',
        isUnqualified ? 'is-unqualified' : '',
        isRetired ? 'is-retired' : '',
        preparationPhase ? `is-${preparationPhase}` : ''
      ]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={titleId}
      data-product-id={product.id}
    >
      {!isRetired && cardCopy.headerStatus ? (
        <header className="merch-product-card__header">
          <span>{cardCopy.headerStatus}</span>
        </header>
      ) : null}

      <div
        className="merch-product-card__visual"
        aria-label={
          isEligible
            ? undefined
            : copy.sealedAria
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
        {!isRetired ? <MerchInventoryBadge
          inventory={inventory}
          loadState={inventoryLoadState}
          productId={product.id}
        /> : null}
        {!isRetired && cardCopy.visualStatus ? (
          <span className="merch-product-card__lock-label">
            {cardCopy.visualStatus}
          </span>
        ) : null}
      </div>

      <div className="merch-product-card__body">
        <div>
          <div className="merch-product-card__title-row">
            <h2 id={titleId}>{cardCopy.title}</h2>
            {isRetired ? <StoreReleaseStatus /> : null}
          </div>
          <p className="merch-product-card__description">
            {isRetired ? readMerchProductDescription(product.id, locale) : cardCopy.description}
          </p>
          {isEligible && !isSoldOut ? (
            <p
              className={`merch-product-card__claim-status merch-product-card__claim-status--${
                accessState.claimStatus || 'not-started'
              }`}
            >
              <span>{copy.claimForm}</span>
              <strong>{readClaimStatus(accessState.claimStatus, locale)}</strong>
            </p>
          ) : null}
        </div>

        <div className="merch-product-card__access">
          <button
            aria-describedby={helperText && !isSoldOut ? helperId : undefined}
            disabled={disabled || isSoldOut}
            onClick={() => onCheck(product.id)}
            type="button"
          >
            {isSoldOut ? (
              copy.soldOut
            ) : preparationPhase ? (
              <ProductPreparationLabel
                percent={preparationPercent}
                phase={preparationPhase}
              />
            ) : (
              cardCopy.buttonLabel
            )}
          </button>
          {helperText && !isSoldOut ? <p id={helperId}>{helperText}</p> : null}
        </div>
      </div>
    </article>
  );
}

const cardCopyByLocale = {
  ko: {
    claimForm: "수령 신청서",
    sealedAria: "자격 확인이 완료될 때까지 상품은 봉인된 상태로 유지됩니다.",
    soldOut: "수령 마감"
  },
  en: {
    claimForm: 'Claim form',
    sealedAria: 'This release remains sealed until access is checked.',
    soldOut: 'Sold out'
  },
  'zh-TW': {
    claimForm: '領取表單',
    sealedAria: '此商品會保持封存，直到完成資格檢查。',
    soldOut: '已全數領取'
  }
} as const;
