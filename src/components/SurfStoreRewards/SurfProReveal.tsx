import { useCallback, useEffect, useRef, useState } from 'react';
import { surfStoreRewards, type SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { useLocale } from '../../i18n/LocaleContext';
import { SurfProCard } from './SurfProCard';
import { SurfRewardAccountForm } from './SurfRewardAccountForm';
import { surfProCopy } from './surfProCopy';
import { useSurfProAdmission } from './useSurfProAdmission';
import { useSurfProMotion } from './useSurfProMotion';
import { useSurfSceneNavigation } from './useSurfSceneNavigation';
import { useElementPresence } from '../../hooks/useElementPresence';
import type { SurfProMetalController, SurfProMetalStatus } from './effects/mountSurfProMetal';
import './SurfProReveal.css';
import './SurfSceneMotion.css';

export default function SurfProReveal({ onBack }: { onBack: () => void }) {
  const { locale } = useLocale();
  const copy = surfProCopy[locale];
  const admission = useSurfProAdmission();
  const materialController = useRef<SurfProMetalController | null>(null);
  const [materialStatus, setMaterialStatus] = useState<SurfProMetalStatus>({ state: 'checking' });
  const [materialRevision, setMaterialRevision] = useState(0);
  const materialReady = materialStatus.state === 'ready' || materialStatus.state === 'paused';
  const ready = admission.ready && materialReady;
  const onProgress = useCallback((progress: number) => materialController.current?.setProgress(progress), []);
  const requestBack = useSurfSceneNavigation(onBack);
  const motion = useSurfProMotion(ready, onProgress);
  const intro = useElementPresence<HTMLParagraphElement>(motion.phase === 'idle');
  const hint = useElementPresence<HTMLParagraphElement>(ready && motion.phase === 'idle');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const reward = surfStoreRewards.find((item): item is SurfActiveStoreReward => item.id === 'pro-month')!;
  const loadingStage = admission.ready ? 'render' : admission.progress.stage;
  const error = admission.error || materialStatus.state === 'error';
  function retry() {
    setMaterialStatus({ state: 'checking' });
    setMaterialRevision(value => value + 1);
    admission.retry();
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <main ref={motion.journeyRef} className="surf-pro-journey" aria-labelledby="surf-pro-title"
      data-reveal-phase={motion.phase} data-media-ready={ready} data-gpu-state={materialStatus.state}
      data-admission-stage={ready ? 'ready' : loadingStage}>
      <section className="surf-pro-scene">
        <header className="surf-pro-toolbar">
          <button data-scene-item onClick={requestBack} type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>{copy.back}</button>
          <span data-scene-item>RENAISS × SURF</span>
          <h1 ref={titleRef} id="surf-pro-title" className="sr-only" tabIndex={-1}>Surf Pro · {copy.duration}</h1>
        </header>
        <p ref={intro.ref} className="surf-pro-intro" data-visible={intro.visible} aria-hidden={motion.phase !== 'idle'}><span data-motion-item>{copy.backIntro}</span></p>
        <SurfProCard logoUrl={admission.logoUrl} renaissLogoUrl={admission.renaissLogoUrl} duration={copy.duration} ready={ready}
          frontVisible={motion.frontVisible} materialRevision={materialRevision}
          controllerRef={materialController} onStatus={setMaterialStatus} />
        <section className="surf-pro-details">
          <SurfRewardAccountForm reward={reward} title={copy.title} description={copy.description}
            showLogo={false} className="surf-pro-account" open={motion.showForm} onHidden={motion.onAccountHidden} />
        </section>
        <p ref={hint.ref} className="surf-pro-scroll-hint" data-visible={hint.visible} aria-hidden={!ready || motion.phase !== 'idle'}><span data-motion-item>{copy.scroll}<span aria-hidden="true">↓</span></span></p>
        {!ready && !error ? <section className="surf-pro-loader" role="status" aria-live="polite">
          <p data-scene-item><span>{copy.loading[loadingStage]}</span><span>{Math.min(99, admission.progress.percent)}%</span></p>
          <progress data-scene-item value={Math.min(99, admission.progress.percent)} max={100} aria-label={copy.loading[loadingStage]} />
        </section> : null}
        {error ? <section className="surf-pro-error" role="alert"><p data-scene-item>{materialStatus.state === 'error' ? copy.gpuError : copy.error}</p><button data-scene-item type="button" onClick={retry}>{copy.retry}</button></section> : null}
      </section>
    </main>
  );
}
