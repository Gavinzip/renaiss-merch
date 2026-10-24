import type { CSSProperties } from "react";

// Renaiss frontImageUrl is a square product render. These are the reference
// binder's normalized bounds for the graded slab and its stand.
export const BINDER_CARD_CROP = { left: 0.27, top: 0.07, width: 0.462, height: 0.81 };
export const BINDER_CARD_ASPECT = BINDER_CARD_CROP.width / BINDER_CARD_CROP.height;
export const BINDER_CARD_IMAGE_STYLE: CSSProperties = {
  inset: "auto",
  left: `${-100 * BINDER_CARD_CROP.left / BINDER_CARD_CROP.width}%`,
  top: `${-100 * BINDER_CARD_CROP.top / BINDER_CARD_CROP.height}%`,
  width: `${100 / BINDER_CARD_CROP.width}%`,
  height: `${100 / BINDER_CARD_CROP.height}%`,
  maxWidth: "none",
  maxHeight: "none",
  objectFit: "fill",
};
