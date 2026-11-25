import type { AppLocale } from '../../i18n/LocaleContext';
import type { Prize } from './useSurfDraw';
import { surfDrawCopy } from './SurfDrawCopy';
import { surfDrawSceneCopy } from './SurfDrawSceneCopy';
import { surfWinnerDisplayName } from '../../../shared/surf-draw-identity.js';
import './SurfWinnerList.css';

export type SurfDisplayWinner = { slot: number; ticketNumber: number; participant: { name: string } };

// The original ceremony list is shared by the public campaign and private draw
// room. Ceremony controls exist only when their real handler is supplied.
export function SurfWinnerList({ locale, prizes, winners, myTickets, onViewCards, controlsDisabled = false }: {
  locale: AppLocale; prizes: readonly Prize[]; winners: readonly SurfDisplayWinner[];
  myTickets?: { start: number; end: number } | null;
  onViewCards?: (kind: Prize['kind']) => void; controlsDisabled?: boolean;
}) {
  const copy = surfDrawCopy(locale), scene = surfDrawSceneCopy(locale);
  return <div className="surf-draw-results__groups" aria-label={copy.prizeBoard}>
    {(['mystery-box', 'surf-pro-month'] as const).map(kind => {
      const group = winners.filter(winner => prizes[winner.slot]?.kind === kind).sort((a, b) => a.slot - b.slot);
      const total = prizes.filter(prize => prize.kind === kind).length;
      const label = kind === 'mystery-box' ? scene.boxCount : scene.proCount;
      return <section className="surf-draw-results__group" key={kind} aria-label={label}>
        <div className="surf-draw-results__group-heading">
          <h3>{label}<small>{String(group.length).padStart(2, '0')} / {String(total).padStart(2, '0')}</small></h3>
          {group.length > 0 && onViewCards ? <button type="button" disabled={controlsDisabled} onClick={() => onViewCards(kind)}>{locale === 'zh-TW' ? '查看卡片' : locale === 'ko' ? '카드 보기' : 'View cards'} ↗</button> : null}
        </div>
        {group.length > 0 ? <ol className="surf-draw-results__list">{group.map(winner => {
          const mine = myTickets && winner.ticketNumber >= myTickets.start && winner.ticketNumber <= myTickets.end;
          return <li key={winner.slot} data-mine={Boolean(mine)}><span>{String(winner.slot + 1).padStart(2, '0')}</span>
            <strong>{mine ? copy.youWon : surfWinnerDisplayName(winner.participant.name) || scene.nameUnavailable}</strong>
            <small>{copy.ticket} #{winner.ticketNumber}</small></li>;
        })}</ol> : null}
      </section>;
    })}
  </div>;
}
