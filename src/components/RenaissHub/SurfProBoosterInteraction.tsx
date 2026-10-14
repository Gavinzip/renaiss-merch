import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { packIndex, PRO_PACK_COUNT } from './draw-effects/batch-ceremony/proBoosterCarousel';
import './SurfProBoosterInteraction.css';

type PackControls = {
  onOpen: () => void; onPreview: (progress: number) => void; onRelease: () => void;
  onSelect: (index: number) => void; onRotate: (delta: number, animated?: boolean) => void; onFocus: (focused: boolean) => void;
};
export function SurfProBoosterInteraction({ locale, onOpen, onPreview, onRelease, onSelect, onRotate, onFocus }: PackControls & { locale: AppLocale }) {
  const [selected, setSelected] = useState(0), [focused, setFocused] = useState(false);
  const drag = useRef<{ start: number; last: number; width: number; distance: number; mode: 'turn' | 'browse' | 'tear' } | null>(null);
  const dragged = useRef(false);
  const zh = locale === 'zh-TW', ko = locale === 'ko';
  const label = zh ? '開啟會員卡包' : ko ? '멤버십 팩 열기' : 'Open membership pack';
  function select(index: number) { const next = packIndex(index); setSelected(next); onSelect(next); }
  function focus(value: boolean) { setFocused(value); onFocus(value); }
  function pointerDown(event: PointerEvent<HTMLElement>, mode: 'turn' | 'browse' | 'tear') {
    if (event.button !== 0) return;
    dragged.current = false;
    drag.current = { start: event.clientX, last: event.clientX, width: event.currentTarget.clientWidth, distance: 0, mode };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLElement>) {
    const current = drag.current; if (!current) return;
    current.distance = event.clientX - current.start;
    if (Math.abs(current.distance) > 7) dragged.current = true;
    if (current.mode === 'turn') onRotate((event.clientX - current.last) / current.width * Math.PI * 2);
    if (current.mode === 'tear') onPreview(Math.max(0, current.distance) / (current.width * .65));
    current.last = event.clientX;
  }
  function pointerUp() {
    const current = drag.current; drag.current = null; if (!current) return;
    if (current.mode === 'browse' && Math.abs(current.distance) > 35) select(selected - Math.sign(current.distance));
    if (current.mode === 'tear') {
      if (current.distance > current.width * .4) onOpen(); else onRelease();
    }
  }
  const cancel = () => { drag.current = null; dragged.current = true; onRelease(); };
  return <div className="surf-pro-booster-interaction" data-focused={focused}>
    {!focused ? <>
      <div className="surf-pro-booster-browse" aria-hidden="true" onPointerDown={event => pointerDown(event, 'browse')}
        onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancel} />
      {Array.from({ length: PRO_PACK_COUNT }, (_, index) => {
        const distance = ((index - selected + 10) % PRO_PACK_COUNT) - 3;
        if (distance === 0) return null;
        return <button key={index} type="button" className="surf-pro-booster-choice" style={{ '--pack-distance': Math.sin(distance * Math.PI * 2 / PRO_PACK_COUNT) / Math.sin(Math.PI * 2 / PRO_PACK_COUNT), zIndex: 4 - Math.abs(distance), '--pack-scale': 1 / (1 + .21 * Math.abs(distance)), '--pack-lower': `${Math.abs(distance) * 12}px` } as CSSProperties}
          aria-label={`${zh ? '選擇卡包' : ko ? '팩 선택' : 'Select pack'} ${index + 1}`}
          onPointerDown={event => pointerDown(event, 'browse')} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancel}
          onClick={() => { if (!dragged.current) select(index); dragged.current = false; }} />;
      })}
    </> : null}
    <button className="surf-pro-booster-hit" type="button" aria-label={focused ? label : `${zh ? '查看卡包' : ko ? '팩 살펴보기' : 'Inspect pack'} ${selected + 1}`}
      onPointerDown={event => pointerDown(event, focused ? 'tear' : 'turn')}
      onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancel}
      onKeyDown={event => {
        if (!focused && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); onRotate(event.key === 'ArrowLeft' ? -Math.PI / 4 : Math.PI / 4, true); }
      }}
      onClick={() => { if (!dragged.current) { if (focused) onOpen(); else focus(true); } dragged.current = false; }}>
    </button>
    <div className="surf-pro-booster-picker">
      <p>{focused ? zh ? '沿卡包上緣向右撕開。' : ko ? '팩 윗부분을 오른쪽으로 뜯어 여세요.' : 'Drag right across the top seal to open.'
        : zh ? '拖曳卡包旋轉 · 滑動兩側挑選 · 點擊選定' : ko ? '팩을 드래그해 회전 · 양옆에서 탐색 · 눌러 선택' : 'Drag the pack to turn · Swipe beside it to browse · Tap to choose'}</p>
      <div className="surf-pro-booster-picker__controls">
        {!focused ? <>
          <button type="button" aria-label={zh ? '上一個卡包' : ko ? '이전 팩' : 'Previous pack'} onClick={() => select(selected - 1)}>←</button>
          <span aria-live="polite">{String(selected + 1).padStart(2, '0')}<i>/ {String(PRO_PACK_COUNT).padStart(2, '0')}</i></span>
          <button type="button" aria-label={zh ? '下一個卡包' : ko ? '다음 팩' : 'Next pack'} onClick={() => select(selected + 1)}>→</button>
          <button type="button" className="surf-pro-booster-turn" aria-label={zh ? '旋轉卡包' : ko ? '팩 회전' : 'Turn pack'} onClick={() => onRotate(Math.PI, true)}>↻</button>
          <button className="surf-pro-booster-select" type="button" onClick={() => focus(true)}>{zh ? '選這一包' : ko ? '이 팩 선택' : 'Choose this pack'} ↗</button>
        </> : <>
          <button type="button" className="surf-pro-booster-back" onClick={() => focus(false)}>{zh ? '重新挑選' : ko ? '다시 선택' : 'Back to packs'}</button>
          <button className="surf-pro-booster-open" type="button" onClick={onOpen}>{label}<span aria-hidden="true">↗</span></button>
        </>}
      </div>
    </div>
  </div>;
}
