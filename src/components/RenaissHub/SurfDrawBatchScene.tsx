import { useEffect, useRef } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import type { Prize, Winner } from './useSurfDraw';
import type { RevealPhase } from './useSurfDrawPresentation';
import { useSurfDrawMotionAssets } from './surfDrawMotionContext';
import type { SurfDrawMediaState } from './surfDrawMedia';
import { SurfDrawBatchCard } from './SurfDrawBatchCard';
import { useSurfBatchFlight } from './useSurfBatchFlight';
import { surfProCopy } from '../SurfStoreRewards/surfProCopy';
import './SurfDrawBatchScene.css';
import { SurfProBoosterInteraction } from './SurfProBoosterInteraction';
import { surfCampaign } from '../../../shared/surf-campaign.js';

export function SurfDrawBatchScene({ locale, prize, amount, start, winners, phase, revision, progress, simulation,
  selectedKind, onSelectKind, prizes, visibleWinners, selectionDisabled,
  onStatus, onSettled, onRevealed }: {
  locale: AppLocale; prize: Prize; amount: number; start: number; winners: Winner[]; phase: RevealPhase; revision: number;
  selectedKind: Prize['kind']; onSelectKind: (kind: Prize['kind']) => void; prizes: Prize[]; visibleWinners: Winner[]; selectionDisabled: boolean;
  progress: { current: number; total: number } | null; simulation: boolean;
  onStatus: (state: SurfDrawMediaState) => void; onSettled: () => void; onRevealed: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { box, card, images, logos, retry } = useSurfDrawMotionAssets();
  const media = prize.kind === 'mystery-box' ? box : card;
  // Both ceremonies need the partner logos. Surface that shared failure even
  // while the box artwork itself has already reached 99%.
  const artworkError = media.error || card.error;
  const isBox = prize.kind === 'mystery-box';
  const revealing = phase === 'identity' || phase === 'revealed';
  const flight = useSurfBatchFlight({ root, canvas, phase, revision, kind: prize.kind, duration: surfProCopy[locale].duration, progress, images, logos, onSettled, onRevealed });
  useEffect(() => { onStatus({ stage: 'render', percent: flight.ready ? 100 : Math.min(99, media.percent), ready: media.ready && flight.ready, error: artworkError || Boolean(flight.error) }); }, [media, artworkError, flight.ready, flight.error, onStatus]);
  const title = locale === 'zh-TW' ? revealing ? '幸運，一起揭曉。' : isBox && amount === 7 ? '一箱期待，七份幸運。' : '幸運，即將一起登場。'
    : locale === 'ko' ? revealing ? '행운을 함께 공개합니다.' : '행운이 곧 펼쳐집니다.'
    : revealing ? 'A little luck, shared.' : isBox ? 'Good things come together.' : 'Your next chapter, sealed.';
  const total = amount;
  return <div ref={root} className="surf-batch-scene" data-phase={phase} data-kind={prize.kind} data-count={total} data-prepared={flight.ready}>
    <div className="surf-batch-heading">
      <span>RENAISS × SURF <i />{simulation ? 'LOCAL SIMULATION' : 'ON-CHAIN REVEAL'}</span>
      <h2>{title}</h2>
      <p>{phase === 'identity'
        ? locale === 'zh-TW' ? `點擊卡片翻開 · ${flight.revealed.length} / ${total}`
          : locale === 'ko' ? `카드를 눌러 공개 · ${flight.revealed.length} / ${total}`
            : `TAP A CARD TO REVEAL · ${flight.revealed.length} / ${total}`
        : <>{String(total).padStart(2, '0')} {isBox ? 'MYSTERY BOXES' : 'PRO MEMBERSHIPS'} <b>·</b> {String(start + 1).padStart(2, '0')}—{String(start + total).padStart(2, '0')}</>}</p>
      {!isBox ? <div className="surf-batch-quota"><b>{locale === 'zh-TW' ? `會員共 ${surfCampaign.plannedRewards.proMonthTrials} 份` : locale === 'ko' ? `총 멤버십 ${surfCampaign.plannedRewards.proMonthTrials}개` : `${surfCampaign.plannedRewards.proMonthTrials} MEMBERSHIPS TOTAL`}</b><i />
        {locale === 'zh-TW' ? `本批 ${total} 份` : locale === 'ko' ? `이번 팩 ${total}개` : `${total} IN THIS BATCH`}</div> : null}
      <div className="surf-batch-prize-picker" role="group" aria-label={locale === 'zh-TW' ? '選擇正式開獎獎項' : 'Choose prize group'}>
        {(['mystery-box', 'surf-pro-month'] as const).map(kind => {
          const drawn = visibleWinners.filter(winner => prizes[winner.slot]?.kind === kind).length;
          const totalPrizes = prizes.filter(item => item.kind === kind).length;
          return <button key={kind} type="button" aria-pressed={selectedKind === kind}
            disabled={selectionDisabled || drawn === totalPrizes} onClick={() => onSelectKind(kind)}>
            {kind === 'mystery-box' ? 'Mystery Box' : 'Pro Membership'} <small>{totalPrizes - drawn}</small>
          </button>;
        })}
      </div>
    </div>
    {!isBox && phase === 'settling' && !flight.packOpened && flight.ready ? <SurfProBoosterInteraction locale={locale} onOpen={flight.openPack} onPreview={flight.previewPack} onRelease={flight.releasePack} onSelect={flight.selectPack} onRotate={flight.rotatePack} onFocus={flight.focusPack} /> : null}
    <canvas ref={canvas} className="surf-batch-webgl" aria-hidden="true" />
    <div className="surf-batch-flash" aria-hidden="true" />
      {phase === 'spinning' ? <div className="surf-batch-progress"><span>{locale === 'zh-TW' ? '等待這批獎項確認' : locale === 'ko' ? '이번 추첨 확인 대기 중' : 'AWAITING DRAW CONFIRMATION'}</span>
        <div className="surf-batch-progress__transaction" aria-hidden="true"><i data-confirmed={(progress?.current ?? 0) === total} /></div>
        <p>{locale === 'zh-TW' ? '確認後一起揭曉' : locale === 'ko' ? '확인 후 함께 공개' : 'Revealing together after confirmation'}</p></div> : null}
    {!media.ready || !flight.ready ? <div className="surf-batch-loading" role={artworkError || flight.error ? 'alert' : 'status'}>
      {flight.error ? <><span>{locale === 'zh-TW' ? '立體開獎場景準備失敗' : 'The 3D ceremony could not prepare'}</span><small>{flight.error}</small><button type="button" onClick={() => window.location.reload()}>{locale === 'zh-TW' ? '重新載入' : 'Reload'}</button></>
        : artworkError ? <><span>{locale === 'zh-TW' ? '獎品動畫載入失敗' : 'Prize motion could not load'}</span><button onClick={retry} type="button">{locale === 'zh-TW' ? '重試' : 'Retry'}</button></>
        : <span>{locale === 'zh-TW' ? '準備立體開獎場景' : 'Preparing the 3D ceremony'} · {Math.min(99, media.percent)}%</span>}
    </div> : null}
    <ol className="surf-batch-gallery" aria-label={locale === 'zh-TW' ? '本批得獎者' : 'Batch winners'} aria-live="polite" aria-busy={phase === 'idle' || phase === 'spinning' || phase === 'settling' || phase === 'ticket'}>
      {Array.from({ length: total }, (_, index) => {
        const winner = winners[index];
        const shown = phase === 'revealed' || flight.revealed.includes(index);
        const lastRow = Math.floor(index / 4) === Math.floor((total - 1) / 4);
        const column = index % 4 * 2 + 1 + (lastRow && total % 4 ? 4 - total % 4 : 0);
        return <SurfDrawBatchCard key={start + index} locale={locale} kind={prize.kind} slot={start + index}
          column={column} winner={winner} phase={phase} shown={shown} turning={flight.flipping === index}
          disabled={flight.flipping !== null || !flight.ready} onFlip={() => flight.flipCard(index)} />;
      })}
    </ol>
  </div>;
}
