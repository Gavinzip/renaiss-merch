import { useEffect } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { surfBoxCopy } from '../SurfStoreRewards/surfBoxCopy';
import { surfDrawSceneCopy } from './SurfDrawSceneCopy';
import { SurfDrawBox } from './SurfDrawBox';
import { SurfDrawMembership } from './SurfDrawMembership';
import { useSurfDrawMotionAssets } from './surfDrawMotionContext';
import { type SurfDrawMediaState } from './surfDrawMedia';
import type { Prize } from './useSurfDraw';
import type { RevealPhase } from './useSurfDrawPresentation';
import './SurfDrawPrize.css';

export function SurfDrawPrize({ locale, prize, phase, revision, onStatus, onRevealed }: {
  locale: AppLocale; prize: Prize; phase: RevealPhase; revision: number;
  onStatus: (state: SurfDrawMediaState) => void; onRevealed: () => void;
}) {
  const copy = surfDrawSceneCopy(locale);
  const mediaCopy = surfBoxCopy[locale];
  const { box, card, retry } = useSurfDrawMotionAssets();
  const isBox = prize.kind === 'mystery-box';
  const media = isBox ? box : card;
  const revealed = phase === 'identity' || phase === 'revealed';
  useEffect(() => { onStatus(media); }, [media, onStatus]);
  return <div className="surf-reveal-prize" data-kind={prize.kind} data-prize-phase={phase}>
    <div className="surf-reveal-prize__caption"><span>{revealed ? copy.latest : copy.next}</span><span>{copy.prize} {String(prize.slot + 1).padStart(2, '0')} / 27</span></div>
    <figure className="surf-reveal-prize__object surf-draw-prize-object" data-kind={prize.kind} data-ready={media.ready}>
      <div className="surf-draw-prize-layer surf-draw-prize-layer--box" aria-hidden={!isBox}>
        <SurfDrawBox phase={isBox ? phase : 'revealed'} revision={revision} active={isBox} onRevealed={onRevealed} />
      </div>
      <div className="surf-draw-prize-layer surf-draw-prize-layer--membership" aria-hidden={isBox}>
        <SurfDrawMembership locale={locale} phase={isBox ? 'idle' : phase} active={!isBox} onRevealed={onRevealed} />
      </div>
      {!media.ready ? <div className="surf-draw-prize-loading" role={media.error ? 'alert' : 'status'}>
        {media.error ? <><span>{locale === 'zh-TW' ? '獎品動畫無法載入' : locale === 'ko' ? '경품 애니메이션을 불러오지 못했습니다' : 'Prize animation could not load'}</span><button type="button" onClick={retry}>{mediaCopy.retry}</button></> : <>
          <span>{mediaCopy.loading[media.stage]} <b>{media.percent}%</b></span><progress max={100} value={media.percent} />
        </>}
      </div> : null}
    </figure>
    <div className="surf-reveal-prize__name"><h2>{isBox ? copy.box : copy.pro}</h2><p>{isBox ? copy.boxDetail : copy.proDetail}</p></div>
  </div>;
}
