import { useEffect, useState } from 'react';
import { useLocale } from '../../i18n/LocaleContext';

export type ProductPreparationPhase = 'checking' | 'making';

type ProductPreparationLabelProps = {
  percent?: number;
  phase: ProductPreparationPhase;
};

export function ProductPreparationLabel({
  percent = 0,
  phase
}: ProductPreparationLabelProps) {
  const { locale } = useLocale();
  const copy = preparationCopy[locale];
  const displayPercent = useCountedProgress(percent, phase === 'making');

  return (
    <span
      className={`merch-product-preparation is-${phase}`}
      aria-live="polite"
    >
      <span className="merch-product-preparation__copy">
        <span>
          {phase === 'checking'
            ? copy.checking
            : copy.making}
        </span>
        <span
          aria-hidden="true"
          className="merch-product-preparation__dots"
        >
          <i />
          <i />
          <i />
        </span>
      </span>
      {phase === 'making' ? (
        <strong
          aria-hidden="true"
          className="merch-product-preparation__percent"
        >
          {displayPercent}%
        </strong>
      ) : null}
    </span>
  );
}

const preparationCopy = {
  en: {
    checking: 'Checking Access',
    making: 'Making Your Merch'
  },
  'zh-TW': {
    checking: '正在檢查資格',
    making: '正在準備商品'
  }
} as const;

function useCountedProgress(targetPercent: number, active: boolean) {
  const target = Math.min(99, Math.max(0, Math.round(targetPercent)));
  const [displayPercent, setDisplayPercent] = useState(0);

  useEffect(() => {
    if (!active) {
      setDisplayPercent(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setDisplayPercent((currentPercent) => {
        if (currentPercent >= target) {
          window.clearInterval(intervalId);
          return currentPercent;
        }

        return currentPercent + 1;
      });
    }, 18);

    return () => window.clearInterval(intervalId);
  }, [active, target]);

  return displayPercent;
}
