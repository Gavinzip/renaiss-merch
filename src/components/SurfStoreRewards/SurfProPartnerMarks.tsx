type Props = { surfLogoUrl: string; renaissLogoUrl: string };

// Official artwork at its native aspect ratio, on the rear face only.
export function SurfProPartnerMarks({ surfLogoUrl, renaissLogoUrl }: Props) {
  return <g>
    <image href={renaissLogoUrl} x="134" y="199" width="268" height="65.953" />
    <text x="443" y="239" textAnchor="middle" fill="#6d8278" fontSize="27" fontWeight="350">×</text>
    <image href={surfLogoUrl} x="487" y="188" width="88" height="88" />
  </g>;
}
