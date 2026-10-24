import type { CSSProperties } from "react";
import { isSampleCard, isPortraitCard, type BinderCollectible } from "./binderCollectible";
import { binderSampleCardUrl } from "./binderAssets";
import { BINDER_CARD_ASPECT, BINDER_CARD_IMAGE_STYLE } from "./binderCardCrop";
import "./BinderCollectibleArt.css";

export function BinderCollectibleArt({
  item, className, onError, decorative = false, loading,
}: {
  item: BinderCollectible;
  className?: string;
  onError?: () => void;
  decorative?: boolean;
  loading?: "lazy" | "eager";
}) {
  const card = isPortraitCard(item);
  const image = <img
    src={isSampleCard(item) ? binderSampleCardUrl(item.sampleCard.image) : item.imageUrl}
    alt={decorative ? "" : item.name}
    draggable={false}
    className={card ? undefined : className}
    style={card ? BINDER_CARD_IMAGE_STYLE : undefined}
    width={card ? 2000 : 240}
    height={card ? 2000 : 240}
    onError={onError}
    loading={loading}
  />;
  return card ? <span
    className={`binder-card-art ${className || ""}`}
    style={{ "--slab-ar": BINDER_CARD_ASPECT } as CSSProperties}
  >{image}</span> : image;
}
