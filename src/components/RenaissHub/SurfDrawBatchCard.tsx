import type { AppLocale } from '../../i18n/LocaleContext';
import { surfWinnerDisplayName } from '../../../shared/surf-draw-identity.js';
import type { Prize, Winner } from './useSurfDraw';
import type { RevealPhase } from './useSurfDrawPresentation';
import { SurfBatchPrizeThumb } from './SurfBatchPrizeThumb';
import { HubWordmark } from './HubWordmark';
import { SurfLogo } from './SurfLogo';

export function SurfDrawBatchCard({ locale, kind, slot, column, winner, phase, shown, turning, disabled, onFlip }: {
  locale: AppLocale; kind: Prize['kind']; slot: number; column: number; winner?: Winner; phase: RevealPhase;
  shown: boolean; turning: boolean; disabled: boolean; onFlip: () => void;
}) {
  const name = surfWinnerDisplayName(winner?.participant.name) || (locale === 'zh-TW' ? '未提供姓名' : 'Name unavailable');
  const revealable = phase === 'identity' && !shown;
  return <li className="surf-batch-card" style={{ gridColumn: `${column} / span 2` }}
    data-revealable={revealable || undefined} data-turning={turning || undefined} data-revealed={shown}
    aria-hidden={phase === 'idle' || phase === 'spinning'}>
    <div className="surf-batch-card__turn">
      {(['ticket', 'winner'] as const).map(face => <div key={face}
        className={`surf-batch-card__face surf-batch-card__face--${face}`} aria-hidden={face === 'winner' ? !shown : shown}>
        <div className="surf-batch-card__metal" />
        <div className="surf-batch-card__top"><HubWordmark /><b>×</b><SurfLogo /><span>{String(slot + 1).padStart(2, '0')}</span></div>
        <div className="surf-batch-card__body"><SurfBatchPrizeThumb kind={kind} locale={locale} />
          <div className="surf-batch-card__identity">
            <span>{face === 'winner' ? locale === 'zh-TW' ? '得獎者' : 'THE WINNER' : 'WINNING TICKET'}</span>
            {face === 'winner' ? <strong className="surf-batch-card__name" data-long={name.length > 20}>{name}</strong> : null}
            <strong className="surf-batch-card__ticket">{winner ? String(winner.ticketNumber).padStart(6, '0') : '—'}</strong>
          </div>
        </div>
        <div className="surf-batch-card__bottom"><span>{kind === 'mystery-box' ? 'MYSTERY BOX' : 'SURF PRO · 1 MONTH'}</span><i /></div>
      </div>)}
    </div>
    {revealable ? <button className="surf-batch-card__reveal" type="button" disabled={disabled} data-flipping={turning}
      aria-label={locale === 'zh-TW' ? `翻開第 ${slot + 1} 張卡片` : locale === 'ko' ? `${slot + 1}번째 카드 공개` : `Reveal card ${slot + 1}`}
      onClick={onFlip}><span>{locale === 'zh-TW' ? '翻開' : locale === 'ko' ? '공개' : 'REVEAL'} ↗</span></button> : null}
  </li>;
}
