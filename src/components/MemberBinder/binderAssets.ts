import release from "../../../media/member-binder-asset-release.json";
import {
  prefix as badgePrefix,
  release as badgeRelease,
} from "../../../media/member-binder-badges-release.json";

const origin = String(import.meta.env.VITE_STATIC_ASSET_CDN_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

export function binderAssetUrl(key: keyof typeof release.assets) {
  if (!origin || !release.release)
    throw new Error("Binder CDN release is not configured.");
  return `${origin}/${release.prefix}/${release.release}/${release.assets[key].path}`;
}

export function binderBadgeUrl(id: number) {
  if (!origin || !badgeRelease)
    throw new Error("Binder badge release is not configured.");
  return `${origin}/${badgePrefix}/${badgeRelease}/badge-${id}.avif`;
}

export const binderFonts = [
  { key: "regular", family: "Binder Poppins", weight: "400" },
  { key: "semibold", family: "Binder Poppins", weight: "600" },
  { key: "mono", family: "Binder Mono", weight: "100 800" },
]
  .map(
    ({ key, family, weight }) =>
      `@font-face {font-family:'${family}';src:url('${binderAssetUrl(key as keyof typeof release.assets)}') format('woff2');font-style:normal;font-weight:${weight};font-display:swap;}`,
  )
  .join("\n");
