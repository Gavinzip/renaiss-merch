import type { MerchEligibilityResult } from '../../lib/merchEligibility';
import type { PreparedRevealMedia } from '../../lib/revealMediaPreload';
import { QualifiedResult } from '../QualifiedResult/QualifiedResult';
import { UnqualifiedResult } from '../UnqualifiedResult/UnqualifiedResult';
import type { MerchProductId } from './merchCatalog';

type StoreAccessResultProps = {
  onBack: () => void;
  productId: MerchProductId;
  revealMedia?: Pick<
    PreparedRevealMedia,
    'forwardUrl' | 'reverseUrl'
  >;
  result: MerchEligibilityResult;
};

export function StoreAccessResult({
  onBack,
  productId,
  revealMedia,
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
        <QualifiedResult
          productId={productId}
          revealMedia={revealMedia}
          result={result}
        />
      )}
    </div>
  );
}
