import { useId } from 'react';
import './SurfProCredential.css';

// The credential is one vector artwork, not an HTML panel around the page.
export function SurfProCredential({ logoUrl, duration, liveMaterial = false, surfaceOnly = false }: { logoUrl: string; duration: string; liveMaterial?: boolean; surfaceOnly?: boolean }) {
  const id = useId().replace(/:/g, '');
  const paint = (name: string) => `url(#${id}-${name})`;
  return (
    <svg className="surf-pro-credential" viewBox="0 0 720 472" role={surfaceOnly ? 'presentation' : 'img'} aria-hidden={surfaceOnly || undefined} aria-label={surfaceOnly ? undefined : `Surf Pro · ${duration}`}>
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2=".8">
          <stop stopColor="#fcfcf9" /><stop offset=".24" stopColor="#e9ebe9" />
          <stop offset=".46" stopColor="#fffdf7" /><stop offset=".7" stopColor="#dfe5e3" /><stop offset="1" stopColor="#f4f2ee" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffffff" /><stop offset=".5" stopColor="#abb6b177" /><stop offset="1" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id={`${id}-light`}>
          <stop stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".7" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-waves`}>
          <stop stopColor="#becbc3" stopOpacity=".08" /><stop offset="1" stopColor="#91aba0" stopOpacity=".32" />
        </linearGradient>
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".55 .009" numOctaves="2" seed="4" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer><feFuncA type="linear" slope=".035" /></feComponentTransfer>
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>
        <clipPath id={`${id}-face`}><rect x="22" y="20" width="676" height="416" rx="22" /></clipPath>
      </defs>
      {!liveMaterial ? <>
        <ellipse cx="360" cy="448" rx="262" ry="12" fill="#506159" fillOpacity=".08" />
        <rect x="22" y="25" width="676" height="416" rx="22" fill="#9aaca1" fillOpacity=".24" />
        <rect x="22" y="20" width="676" height="416" rx="22" fill={paint('metal')} stroke={paint('edge')} strokeWidth="1.5" />
      </> : null}
      <g clipPath={paint('face')}>
        {!liveMaterial ? <rect x="22" y="20" width="676" height="416" fill={paint('metal')} filter={paint('grain')} /> : null}
        {!surfaceOnly ? <g fill="none" stroke={paint('waves')} strokeWidth="1.1">
          {[0, 1, 2, 3, 4, 5, 6].map(line => <path key={line} d={`M ${380 + line * 18} 440 C ${355 + line * 16} 350, ${655 + line * 17} 350, ${635 + line * 18} 235 S ${565 + line * 17} 85, ${715 + line * 15} 10`} />)}
        </g> : null}
        {!liveMaterial && !surfaceOnly ? <rect className="surf-pro-credential__light" x="0" y="0" width="170" height="500" fill={paint('light')} /> : null}
      </g>
      {!surfaceOnly ? <>
        <image href={logoUrl} x="65" y="60" width="56" height="56" />
        <text className="surf-pro-credential__edition" x="649" y="79" textAnchor="end">RENAISS × SURF</text>
      <text className="surf-pro-credential__name" x="61" y="258">Surf Pro</text>
      <text className="surf-pro-credential__type" x="65" y="298">PRO MEMBERSHIP</text>
      <text className="surf-pro-credential__duration" x="65" y="391">{duration}</text>
      <path d="M604 372h40m-12-12 12 12-12 12" fill="none" stroke="#476158" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </> : null}
    </svg>
  );
}
