import { archiveAssetUrl } from "../../../../shared/archiveAssets.js";
import { useId } from "react";

const pokemon30PrizeBoxCrystalThin = archiveAssetUrl("pokemon-30/src/assets/pokemon30-prize-box-crystal-thin.jpg");

/**
 * The supplied image already contains the approved crystal enclosure. It stays
 * screen-parallel so the page never invents an unsupported side or rear view.
 */
export function PokemonPrizeStage({ decorative = false, label }) {
  const suffix = useId().replaceAll(":", "");
  const outerClipId = `pokemon30-crystal-outer-${suffix}`;
  const artworkClipId = `pokemon30-crystal-art-${suffix}`;
  const frameMaskId = `pokemon30-crystal-frame-${suffix}`;
  const glintId = `pokemon30-crystal-glint-${suffix}`;

  return (
    <div className="pokemon-prize-stage">
      <svg
        className="pokemon-prize-stage__object"
        viewBox="0 0 1254 1254"
        role={decorative ? undefined : "img"}
        aria-hidden={decorative || undefined}
        aria-label={decorative ? undefined : label}
      >
        {decorative ? null : <title>{label}</title>}
        <defs>
          <path
            id={outerClipId}
            d="M 140 100 H 1112 L 1158 146 V 1100 L 1114 1144 H 140 L 96 1100 V 146 Z"
          />
          <clipPath id={artworkClipId} clipPathUnits="userSpaceOnUse">
            <rect x="130" y="132" width="994" height="982" rx="8" />
          </clipPath>
          <clipPath id={`${outerClipId}-clip`} clipPathUnits="userSpaceOnUse">
            <use href={`#${outerClipId}`} />
          </clipPath>
          <mask id={frameMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
            <rect width="1254" height="1254" fill="#000" />
            <use href={`#${outerClipId}`} fill="#fff" />
            <rect x="130" y="132" width="994" height="982" rx="8" fill="#000" />
          </mask>
          <linearGradient id={glintId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".44" stopColor="#d8edff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".72" />
            <stop offset=".56" stopColor="#dac5ff" stopOpacity=".1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g className="pokemon-prize-stage__art" clipPath={`url(#${artworkClipId})`}>
          <image href={pokemon30PrizeBoxCrystalThin} width="1254" height="1254" />
        </g>
        <g className="pokemon-prize-stage__frame" mask={`url(#${frameMaskId})`}>
          <image href={pokemon30PrizeBoxCrystalThin} width="1254" height="1254" />
          <rect
            className="pokemon-prize-stage__glint"
            x="-720"
            y="-280"
            width="620"
            height="1880"
            fill={`url(#${glintId})`}
            transform="rotate(24 627 627)"
          />
        </g>
        <use
          className="pokemon-prize-stage__edge"
          href={`#${outerClipId}`}
          fill="none"
          stroke="rgba(225, 240, 255, .7)"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}
