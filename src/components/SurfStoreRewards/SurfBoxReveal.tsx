import { useEffect, useMemo, useRef } from 'react';
import { surfStoreRewards, type SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { useLocale } from '../../i18n/LocaleContext';
import { SurfRewardAccountForm } from './SurfRewardAccountForm';
import { surfBoxCopy } from './surfBoxCopy';
import { useSurfBoxReveal } from './useSurfBoxReveal';
import { useSurfSceneNavigation } from './useSurfSceneNavigation';
import { useElementPresence } from '../../hooks/useElementPresence';
import './SurfBoxReveal.css';
import './SurfSceneMotion.css';

export default function SurfBoxReveal({ onBack }: { onBack: () => void }) {
  const { locale } = useLocale();
  const copy = surfBoxCopy[locale];
  const reward = surfStoreRewards.find((item): item is SurfActiveStoreReward => item.id === 'mystery-box')!;
  const playbackErrors = useMemo(() => ({ closing: copy.playError, decode: copy.loadError, reveal: copy.playError }), [copy]);
  const requestBack = useSurfSceneNavigation(onBack);
  const reveal = useSurfBoxReveal(playbackErrors);
  const hint = useElementPresence<HTMLParagraphElement>(reveal.admitted && reveal.phase === 'idle' && !reveal.playbackError);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <main ref={reveal.journeyRef} className={`surf-box-journey surf-box-journey--${reveal.phase}`}
      aria-labelledby="surf-box-title" data-reveal-phase={reveal.phase}
      data-admission-stage={reveal.admitted ? 'ready' : reveal.progress.stage}
      data-media-ready={reveal.admitted}>
      <section className="surf-box-scene">
        <div className="surf-box-scene__media" aria-hidden="true"><div className="surf-box-scene__media-entry" data-scene-item>
          <video ref={reveal.forwardVideoRef} className={!reveal.admitted || reveal.phase !== 'closing' ? 'is-visible' : ''}
            muted playsInline preload="auto" disablePictureInPicture disableRemotePlayback />
          <video ref={reveal.reverseVideoRef} className={!reveal.admitted || reveal.phase === 'closing' ? 'is-visible' : ''}
            muted playsInline preload="auto" disablePictureInPicture disableRemotePlayback />
          {!reveal.admitted && reveal.posterUrl ? <img src={reveal.posterUrl} alt="" width={1920} height={1080} /> : null}
        </div></div>
        <header className="surf-box-scene__toolbar">
          <button data-scene-item className="surf-box-scene__back" type="button" onClick={requestBack}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg><span>{copy.back}</span>
          </button>
          <h1 ref={titleRef} id="surf-box-title" className="sr-only" tabIndex={-1}>{copy.title}</h1>
        </header>
        {!reveal.admitted && !reveal.loadError ? (
          <div className="surf-box-scene__loader" role="status" aria-live="polite">
            <div data-scene-item><span>{copy.loading[reveal.progress.stage]}</span><span>{reveal.progress.percent}%</span></div>
            <progress data-scene-item max={100} value={reveal.progress.percent} aria-label={copy.loading[reveal.progress.stage]} />
          </div>
        ) : null}
        <p ref={hint.ref} className="surf-box-scene__scroll-hint" data-visible={hint.visible}
          aria-hidden={!reveal.admitted || reveal.phase !== 'idle'}><span data-motion-item>{copy.scrollDown}<span aria-hidden="true">↓</span></span></p>
        {reveal.phase === 'playing' ? <p className="sr-only" role="status">{copy.opening}</p> : null}
        {reveal.loadError || reveal.playbackError ? (
          <div className="surf-box-scene__error" role="alert">
            <p data-scene-item>{reveal.playbackError || copy.loadError}</p><button data-scene-item type="button" onClick={reveal.retry}>{copy.retry}</button>
          </div>
        ) : null}
        <div className="surf-box-scene__account">
          <SurfRewardAccountForm reward={reward} title={copy.title} description={copy.description} open={reveal.showForm} />
        </div>
      </section>
    </main>
  );
}
