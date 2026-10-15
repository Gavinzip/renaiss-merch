import { HubWordmark } from '../RenaissHub/HubWordmark';
import type { RosterWinner } from './types';
import { renaissDrawTagline } from './renaissDrawBrand';
import { renaissRewardBackSurfaceUrl, renaissRewardSurfaceUrl } from './renaissRewardSurface';
import './RenaissRewardCard.css';

export function RenaissRewardCard({ winner, shown, turning, revealable, onFlip }: {
  winner: RosterWinner | null; shown: boolean; turning: boolean;
  revealable: boolean; onFlip: () => void;
}) {
  return <li className="surf-batch-card renaiss-reward-card"
    data-revealable={revealable || undefined} data-turning={turning || undefined} data-revealed={shown}>
    <div className="surf-batch-card__turn">
      <div className="surf-batch-card__face surf-batch-card__face--ticket renaiss-reward-card__back" aria-hidden={shown}>
        <img className="renaiss-reward-card__surface" src={renaissRewardBackSurfaceUrl} alt="" />
        <span className="renaiss-reward-card__edition" data-card-print>RENAISS COLLECTION</span>
        <div className="renaiss-reward-card__brand"><HubWordmark /></div>
        <span className="renaiss-reward-card__tagline" data-card-print>{renaissDrawTagline}</span>
        <canvas className="renaiss-reward-card__spot-foil" aria-hidden="true" />
      </div>
      <div className="surf-batch-card__face surf-batch-card__face--winner" aria-hidden={!shown}>
        <img className="renaiss-reward-card__surface" src={renaissRewardSurfaceUrl} alt="" />
        <div className="surf-batch-card__top">
          <HubWordmark /><span>RENAISS COLLECTION</span>
        </div>
        <div className="surf-batch-card__identity">
          <span>THE WINNER</span>
          <strong className="surf-batch-card__name" data-long={(winner?.name.length ?? 0) > 12 || undefined}>
            {winner?.name}
          </strong>
        </div>
        <div className="surf-batch-card__bottom"><span>{winner?.prize || 'RENAISS · SPECIAL REWARD'}</span><b>RENAISS</b></div>
        <canvas className="renaiss-reward-card__spot-foil" aria-hidden="true" />
      </div>
    </div>
    {revealable ? <button type="button" className="surf-batch-card__reveal" disabled={turning}
      data-flipping={turning} onClick={onFlip} aria-label="翻開得獎者卡片"><span>翻開 ↗</span></button> : null}
  </li>;
}
