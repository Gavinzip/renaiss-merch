import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { packIndex, PRO_PACK_COUNT, packOrbit } from './draw-effects/batch-ceremony/proBoosterCarousel';
import './SurfProBoosterInteraction.css';
import { SurfProBoosterSeal } from './SurfProBoosterSeal';

type PackControls = {
  onSpin?: () => Promise<number | null>;
  onBrowse?: (delta: number, settle: boolean) => number | undefined;
  onOpen: () => boolean | void | Promise<boolean | void>; onPreview: (progress: number) => void; onRelease: () => void;
  onSelect: (index: number) => void; onRotate: (delta: number, animated?: boolean) => void; onFocus: (focused: boolean) => void;
};
export function SurfProBoosterInteraction({ locale, onOpen, onPreview, onRelease, onSelect, onRotate, onFocus, brand, disabledReason, onSpin, onBrowse }: PackControls & { locale: AppLocale; brand?: 'renaiss'; disabledReason?: string }) {
  const [selected, setSelected] = useState(0), [focused, setFocused] = useState(false);
  const [carouselStep, setCarouselStep] = useState<'intro' | 'spinning' | 'browse'>(onSpin ? 'intro' : 'browse');
  const live = useRef(true), spinLock = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  async function spin() {
    if (!onSpin || spinLock.current || disabledReason) return;
    spinLock.current = true; setCarouselStep('spinning');
    const index = await onSpin();
    if (!live.current) return;
    spinLock.current = false;
    if (index !== null) setSelected(index);
    setCarouselStep(index === null ? 'intro' : 'browse');
  }
  const canBrowse = carouselStep === 'browse';
  const drag = useRef<{ start: number; last: number; width: number; distance: number; mode: 'turn' | 'browse' } | null>(null);
  const dragged = useRef(false);
  const zh = locale === 'zh-TW', ko = locale === 'ko';
  const browseHint = onSpin ? (disabledReason || (zh ? '滑動挑選卡包' : 'Swipe to choose')) : (zh ? '拖曳卡包旋轉 · 滑動兩側挑選' : ko ? '팩을 드래그해 회전 · 양옆에서 탐색' : 'Drag the pack to turn · Swipe beside it to browse')
    + (disabledReason ? '' : zh ? ' · 點擊選定' : ko ? ' · 눌러 선택' : ' · Tap to choose');
  function select(index: number) { const next = packIndex(index); setSelected(next); onSelect(next); }
  function focus(value: boolean) { if (value && disabledReason) return; setFocused(value); onFocus(value); }
  function pointerDown(event: PointerEvent<HTMLElement>, mode: 'turn' | 'browse') {
    if (event.button !== 0) return;
    dragged.current = false;
    drag.current = { start: event.clientX, last: event.clientX, width: event.currentTarget.clientWidth, distance: 0, mode };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLElement>) {
    const current = drag.current; if (!current) return;
    current.distance = event.clientX - current.start;
    if (Math.abs(current.distance) > 7) dragged.current = true;
    if (current.mode === 'browse' && onBrowse) {
      const index = onBrowse((event.clientX - current.last) / Math.max(90, current.width * .35), false);
      if (index !== undefined) setSelected(index);
    }
    if (current.mode === 'turn') onRotate((event.clientX - current.last) / current.width * Math.PI * 2);
    current.last = event.clientX;
  }
  function pointerUp() {
    const current = drag.current; drag.current = null; if (!current) return;
    if (current.mode === 'browse' && onBrowse) { const index = onBrowse(0, true); if (index !== undefined) setSelected(index); return; }
    if (current.mode === 'browse' && Math.abs(current.distance) > 35) select(selected - Math.sign(current.distance));
  }
  const cancel = () => { onBrowse?.(0, true); drag.current = null; dragged.current = true; onRelease(); };
  return <div className="surf-pro-booster-interaction" data-focused={focused} data-carousel={carouselStep}>
    {!focused && canBrowse ? <>
      <div className="surf-pro-booster-browse" aria-hidden="true" onPointerDown={event => pointerDown(event, 'browse')}
        onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancel} />
      {Array.from({ length: PRO_PACK_COUNT }, (_, index) => {
        const distance = ((index - selected + 10) % PRO_PACK_COUNT) - 3;
        const orbit = onSpin ? packOrbit(distance) : null;
        if (distance === 0) return null;
        return <button key={index} type="button" className="surf-pro-booster-choice" style={{ '--pack-distance': orbit ? orbit.x / .8 : Math.sin(distance * Math.PI * 2 / PRO_PACK_COUNT) / Math.sin(Math.PI * 2 / PRO_PACK_COUNT), zIndex: 4 - Math.abs(distance), '--pack-scale': orbit ? orbit.scale : 1 / (1 + .21 * Math.abs(distance)), '--pack-lower': orbit ? `calc(var(--pro-pack-height) * ${orbit.lower})` : `${Math.abs(distance) * 12}px`, ...(orbit ? { '--pro-pack-spacing': 'var(--pro-pack-width)' } : {}) } as CSSProperties}
          aria-label={`${zh ? '選擇卡包' : ko ? '팩 선택' : 'Select pack'} ${index + 1}`}
          onPointerDown={event => pointerDown(event, 'browse')} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancel}
          onClick={() => { if (!dragged.current) select(index); dragged.current = false; }} />;
      })}
    </> : null}
    {!focused && canBrowse ? <button className="surf-pro-booster-hit" type="button" aria-label={`${zh ? '查看卡包' : ko ? '팩 살펴보기' : 'Inspect pack'} ${selected + 1}`}
      onPointerDown={event => pointerDown(event, onBrowse ? 'browse' : 'turn')}
      onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancel}
      onKeyDown={event => {
        if (!focused && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); if (onBrowse) select(selected + (event.key === 'ArrowLeft' ? -1 : 1)); else onRotate(event.key === 'ArrowLeft' ? -Math.PI / 4 : Math.PI / 4, true); }
      }}
      onClick={() => { if (!dragged.current) focus(true); dragged.current = false; }}>
    </button> : focused ? <SurfProBoosterSeal locale={locale} onPreview={onPreview} onOpen={onOpen} disabled={Boolean(disabledReason)} /> : null}
    <div className="surf-pro-booster-picker">
      {canBrowse ? <p>{focused ? disabledReason || (zh ? '向右拖曳封口，放手可暫停。' : ko ? '드래그한 만큼 뜯어집니다. 놓으면 멈춥니다.' : 'Pull to tear. Let go to pause. Keep pulling to open.')
        : browseHint}</p> : null}
      <div className="surf-pro-booster-picker__controls">
        {!canBrowse ? <button type="button" className="surf-pro-booster-reveal"
          disabled={carouselStep === 'spinning' || Boolean(disabledReason)} title={disabledReason}
          aria-busy={carouselStep === 'spinning'} onClick={() => void spin()}>Reveal <span aria-hidden="true">↗</span></button>
        : !focused ? <>
          <button type="button" aria-label={zh ? '上一個卡包' : ko ? '이전 팩' : 'Previous pack'} onClick={() => select(selected - 1)}>←</button>
          <span aria-live="polite">{String(selected + 1).padStart(2, '0')}<i>/ {String(PRO_PACK_COUNT).padStart(2, '0')}</i></span>
          <button type="button" aria-label={zh ? '下一個卡包' : ko ? '다음 팩' : 'Next pack'} onClick={() => select(selected + 1)}>→</button>
          {onSpin ? <button type="button" className="surf-pro-booster-turn" disabled={Boolean(disabledReason)} onClick={() => void spin()}>再轉一次 ↻</button> : <button type="button" className="surf-pro-booster-turn" aria-label={zh ? '旋轉卡包' : ko ? '팩 회전' : 'Turn pack'} onClick={() => onRotate(Math.PI, true)}>↻</button>}
          <button className="surf-pro-booster-select" type="button" disabled={Boolean(disabledReason)} onClick={() => focus(true)}>{disabledReason || (zh ? '選這一包' : ko ? '이 팩 선택' : 'Choose this pack')} ↗</button>
        </> : <>
          <button type="button" className="surf-pro-booster-back" onClick={() => focus(false)}>{zh ? '重新挑選' : ko ? '다시 선택' : 'Back to packs'}</button>
          {brand !== 'renaiss' ? <span className="surf-pro-booster-manual">{zh ? '從上方封口開始' : 'START AT THE TOP SEAL'}</span> : null}
        </>}
      </div>
    </div>
  </div>;
}
