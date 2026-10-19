import type { RefObject } from 'react';
import { SurfProCredential } from './SurfProCredential';
import { SurfProPartnerMarks } from './SurfProPartnerMarks';
import { SurfProMetalCanvas } from './effects/SurfProMetalCanvas';
import type { SurfProMetalController, SurfProMetalStatus } from './effects/mountSurfProMetal';
import './SurfProCard.css';

type Props = {
  logoUrl: string;
  renaissLogoUrl: string;
  duration: string;
  ready: boolean;
  frontVisible: boolean;
  materialRevision: number;
  controllerRef: RefObject<SurfProMetalController | null>;
  onStatus: (status: SurfProMetalStatus) => void;
};

// Two physical faces share the approved silver artwork. The GPU is an
// intentional subtle reflection layer, never an alternative on GPU failure.
export function SurfProCard({ logoUrl, renaissLogoUrl, duration, ready, frontVisible, materialRevision, controllerRef, onStatus }: Props) {
  return <figure className="surf-pro-pass" data-ready={ready} data-front-visible={frontVisible}>
    <div className="surf-pro-card-entry" data-scene-item><div className="surf-pro-card-turn">
      <div className="surf-pro-card-face surf-pro-card-front" aria-hidden={!frontVisible}>
        <SurfProCredential logoUrl={logoUrl} duration={duration} surfaceOnly />
        <SurfProMetalCanvas key={materialRevision} controllerRef={controllerRef} onStatus={onStatus} />
        <SurfProCredential logoUrl={logoUrl} duration={duration} liveMaterial />
      </div>
      <div className="surf-pro-card-face surf-pro-card-back" aria-hidden={frontVisible}>
        <SurfProCredential logoUrl={logoUrl} duration={duration} surfaceOnly />
        <svg className="surf-pro-credential" viewBox="0 0 720 472" role="img" aria-label="RENAISS × SURF">
          <SurfProPartnerMarks surfLogoUrl={logoUrl} renaissLogoUrl={renaissLogoUrl} />
        </svg>
      </div>
    </div></div>
  </figure>;
}
