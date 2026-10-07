import { surfPreviewLogoUrl } from "./hubPreviewAssets";

export function SurfLogo() {
  return <img className="hub-surf-logo" src={surfPreviewLogoUrl()} width={400} height={400} alt="Surf AI" />;
}
