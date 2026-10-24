import type { BinderBadge } from "./binderApi";

// Sample cards belong only to the explicitly selected practice collection.
// The authenticated library remains the server's verified SBT response.
export type BinderSampleCard = Omit<BinderBadge, "imageUrl"> & {
  sampleCard: { image: 1 | 2 | 3; edition: number };
};
export type BinderCollectible = BinderBadge | BinderSampleCard;
export function isSampleCard(item: BinderCollectible): item is BinderSampleCard {
  return "sampleCard" in item;
}
export function isPortraitCard(item: BinderCollectible) {
  return isSampleCard(item) || Boolean(item.card);
}
