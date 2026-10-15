import release from "../../../media/roster-draw-asset-release.json";

export function rosterDrawAsset(key: keyof typeof release.assets) {
  const asset = release.assets[key];
  if (import.meta.env.DEV) return `/${asset.source}`;
  const base = String(
    import.meta.env.VITE_STATIC_ASSET_CDN_BASE_URL || "",
  ).replace(/\/+$/, "");
  if (!base || release.release === "unpublished")
    throw new Error(
      "Publish the Charizard media to Cloudflare before release.",
    );
  return `${base}/${release.prefix}/${release.release}/${asset.path}`;
}
