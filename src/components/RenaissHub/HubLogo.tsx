import { hubPreviewLogoUrl } from "./hubPreviewAssets";

// Frame the transparent mark without resampling its pixels. SVG's default
// xMidYMid meet preserves its 2:3 shape in every component's display box.
export function HubLogo() {
  return (
    <svg className="hub-brand-logo" viewBox="86 128 852 1286" width="852" height="1286" aria-hidden="true" focusable="false">
      <image href={hubPreviewLogoUrl()} width="1024" height="1536" />
    </svg>
  );
}
