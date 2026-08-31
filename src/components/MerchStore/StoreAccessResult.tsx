import type { MerchEligibilityResult } from '../../lib/merchEligibility';
import type { PreparedRevealMedia } from '../../lib/revealMediaPreload';
import { QualifiedResult } from '../QualifiedResult/QualifiedResult';
import { UnqualifiedResult } from '../UnqualifiedResult/UnqualifiedResult';
import type { MerchProductId } from './merchCatalog';
import { useLocale } from '../../i18n/LocaleContext';

type StoreAccessResultProps = {
  onBack: () => void;
  onMediaReady?: () => void;
  productId: MerchProductId;
  revealMedia?: Pick<
    PreparedRevealMedia,
    'forwardUrl' | 'reverseUrl'
  >;
  result: MerchEligibilityResult;
};

export function StoreAccessResult({
  onBack,
  onMediaReady,
  productId,
  revealMedia,
  result
}: StoreAccessResultProps) {
  const { locale } = useLocale();

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
        {locale === 'zh-TW' ? '返回商店' : 'Back to store'}
      </button>

      {result.status === 'unqualified' ? (
        <UnqualifiedResult result={result} />
      ) : (
        <QualifiedResult
          onMediaReady={onMediaReady}
          productId={productId}
          revealMedia={revealMedia}
          result={result}
        />
      )}
    </div>
  );
}
