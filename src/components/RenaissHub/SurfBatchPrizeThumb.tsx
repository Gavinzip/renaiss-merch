import { useLayoutEffect, useRef } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import type { Prize } from './useSurfDraw';
import { useSurfDrawMotionAssets } from './surfDrawMotionContext';
import { paintSurfDrawBox, surfBoxMotion } from './draw-effects/surfDrawBoxFrames';
import { SurfProCredential } from '../SurfStoreRewards/SurfProCredential';
import { surfProCopy } from '../SurfStoreRewards/surfProCopy';

// Paint the approved final atlas frame once per small prize thumbnail. The
// decoded bitmaps are shared; seven winners do not download seven animations.
export function SurfBatchPrizeThumb({ kind, locale }: { kind: Prize['kind']; locale: AppLocale }) {
  const { images, logos } = useSurfDrawMotionAssets();
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (kind !== 'mystery-box' || !images || !context) return;
    context.setTransform(240 / surfBoxMotion.tile, 0, 0, 240 / surfBoxMotion.tile, 0, 0);
    paintSurfDrawBox(context, images, surfBoxMotion.frames - 1);
  }, [images, kind]);
  return <div className="surf-batch-card__prize" aria-hidden="true">
    {kind === 'mystery-box' ? <canvas ref={canvas} width="240" height="240" />
      : logos ? <SurfProCredential logoUrl={logos.surf} duration={surfProCopy[locale].duration} /> : null}
  </div>;
}
