import { isSampleCard, type BinderCollectible } from "./binderCollectible";
import { binderSampleCardUrl } from "./binderAssets";

export function BinderCollectibleArt({
  item, className, onError, decorative = false, loading,
}: {
  item: BinderCollectible;
  className?: string;
  onError?: () => void;
  decorative?: boolean;
  loading?: "lazy" | "eager";
}) {
  return <img
    src={isSampleCard(item) ? binderSampleCardUrl(item.sampleCard.image) : item.imageUrl}
    alt={decorative ? "" : item.name}
    draggable={false}
    className={className}
    width={isSampleCard(item) || item.card ? 630 : 240}
    height={isSampleCard(item) || item.card ? 880 : 240}
    onError={onError}
    loading={loading}
  />;
}
