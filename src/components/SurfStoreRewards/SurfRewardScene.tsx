import { lazy, Suspense } from 'react';
import type { SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { HubPageLoading } from '../RenaissHub/HubPageLoading';
import { useLocale } from '../../i18n/LocaleContext';

const SurfBoxReveal = lazy(() => import('./SurfBoxReveal'));
const SurfProReveal = lazy(() => import('./SurfProReveal'));

// Download a reveal engine only after its server access check succeeds.
export default function SurfRewardScene({ rewardId, onBack }: {
  rewardId: SurfActiveStoreReward['id']; onBack: () => void;
}) {
  const { locale } = useLocale();
  return <Suspense fallback={<HubPageLoading locale={locale} ready={false} />}>
    {rewardId === 'mystery-box' ? <SurfBoxReveal onBack={onBack} /> : <SurfProReveal onBack={onBack} />}
  </Suspense>;
}
