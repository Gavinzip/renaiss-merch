import { useState, type CSSProperties } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import './SurfDrawBatchControl.css';

export function SurfDrawBatchControl({ locale, amount, limit, disabled, onChange }: {
  locale: AppLocale; amount: number; limit: number; disabled: boolean; onChange: (amount: number) => void;
}) {
  const [direction, setDirection] = useState(-1);
  const label = locale === 'zh-TW' ? '一次抽出' : locale === 'ko' ? '한 번에 추첨' : 'Draw at once';
  const change = (delta: number) => { setDirection(delta > 0 ? 1 : -1); onChange(amount + delta); };
  return <div className="surf-draw-batch" role="group" aria-label={label}>
    <span className="surf-draw-batch__label">{label}</span>
    <div className="surf-draw-batch__stepper">
      <button type="button" aria-label={locale === 'zh-TW' ? '減少抽獎數量' : locale === 'ko' ? '추첨 수 줄이기' : 'Decrease draw count'}
        disabled={disabled || amount <= 1 || !limit} onClick={() => change(-1)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10" /></svg></button>
      <output aria-live="polite" aria-label={label} className="t-digit-group is-animating" style={{ '--digit-dir-y': direction } as CSSProperties}>
        <span className="t-digit" key={amount}>{amount}</span>
      </output>
      <button type="button" aria-label={locale === 'zh-TW' ? '增加抽獎數量' : locale === 'ko' ? '추첨 수 늘리기' : 'Increase draw count'}
        disabled={disabled || amount >= limit} onClick={() => change(1)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10M10 5v10" /></svg></button>
    </div>
    {limit > 1 ? <button className="surf-draw-batch__all" type="button" disabled={disabled || amount === limit}
      onClick={() => { setDirection(1); onChange(limit); }}>{locale === 'zh-TW' ? `全部 ${limit}` : locale === 'ko' ? `전체 ${limit}` : `All ${limit}`}</button> : null}
  </div>;
}
