import type { MerchEligibilityResult } from '../../lib/merchEligibility';
import { QualifiedResult } from '../QualifiedResult/QualifiedResult';
import { UnqualifiedResult } from '../UnqualifiedResult/UnqualifiedResult';
import type { MerchProductId } from './merchCatalog';

type StoreAccessResultProps = {
  onBack: () => void;
  productId: MerchProductId;
  result: MerchEligibilityResult;
};

export function StoreAccessResult({
  onBack,
  productId,
  result
}: StoreAccessResultProps) {
  return (
    <div
      className={[
        'store-access-result',
        `store-access-result--${productId}`,
        `store-access-result--${result.status}`
      ].join(' ')}
    >
      <button
        className="store-access-result__back"
        onClick={onBack}
        type="button"
      >
        Back to store
      </button>

      {result.status === 'unqualified' ? (
        <UnqualifiedResult result={result} />
      ) : (
        <QualifiedResult productId={productId} result={result} />
      )}
    </div>
  );
}
