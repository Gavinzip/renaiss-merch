import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const surfCampaignHash = '#campaign/surf';
const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
const campaignPieces = '.surf-page__header, .surf-page__brand-pair, .surf-page__eyebrow, .surf-page h1 > span, .surf-page__hero-description, .surf-page__hero-actions, .surf-page__hero-footnote, .surf-page__hero-art, .surf-page__section-heading, .surf-page__reward-grid > article, .surf-page__participation-intro, .surf-page__task-list > ol > li, .surf-page__details, .surf-page__footer';
const overviewPieces = '.hub-home-intro__utility, .renaiss-hub__introduction, .hub-widget__surface, .renaiss-hub__footer';

function isCampaignLocation() {
  const url = new URL(location.href);
  return url.hash === surfCampaignHash || ['x', 'discord', 'resume'].includes(url.searchParams.get('mission') || '');
}

// One motion owner for history, mounted content, focus and scroll. The outgoing
// page stays mounted until its real animations finish; no guessed delay or clone.
export function useHubCampaignRoute() {
  const [active, setActive] = useState(isCampaignLocation);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = useRef(active);
  const requested = useRef(active);
  const generation = useRef(0);
  const direction = useRef(1);
  const animations = useRef(new Set<Animation>());
  const dashboardPosition = useRef(0);
  const triggerKey = useRef<string | null>(null);
  const hasOpened = useRef(false);

  function cancelMotion() {
    animations.current.forEach(animation => animation.cancel());
    animations.current.clear();
    // Settle the campaign's viewport reveals before the route owns its exit.
    ref.current?.querySelectorAll<HTMLElement>('[data-surf-reveal]').forEach(element => {
      element.getAnimations().forEach(animation => animation.cancel());
    });
  }
  function pieces(campaign: boolean) {
    return [...(ref.current?.querySelectorAll<HTMLElement>(campaign ? campaignPieces : overviewPieces) || [])]
      .filter(element => { const rect = element.getBoundingClientRect(); return rect.bottom > 0 && rect.top < innerHeight && rect.width > 0; });
  }
  function run(element: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
    const animation = element.animate(frames, { ...options, fill: 'both' });
    animations.current.add(animation);
    return animation;
  }

  useEffect(() => {
    const sync = async () => {
      const target = isCampaignLocation();
      if (target === requested.current) return;
      requested.current = target;
      const ticket = ++generation.current;
      cancelMotion();
      if (target === current.current) {
        setBusy(false);
        setRevision(value => value + 1);
        return;
      }
      direction.current = target ? 1 : -1;
      if (!current.current) {
        dashboardPosition.current = scrollY;
        hasOpened.current = true;
      }
      setBusy(true);
      if (!document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const exiting = pieces(current.current).map((element, index) => run(element, [
          { opacity: 1, transform: 'none', filter: 'blur(0px)' },
          { opacity: .08, transform: current.current ? `translate3d(${direction.current * -32}px, -8px, 0) scale(.97)` : 'translateY(-6px)', filter: `blur(${current.current ? 7 : 3}px)` },
        ], { duration: 250, delay: Math.min(index * 18, 72), easing: ease }));
        // Cancellation is an expected lifecycle event (rapid Back, reduce motion,
        // hidden tab or unmount), never a signal to fabricate a navigation result.
        await Promise.allSettled(exiting.map(animation => animation.finished));
      }
      if (ticket !== generation.current) return;
      current.current = target;
      setActive(target);
      setRevision(value => value + 1);
      setBusy(false);
    };
    const stop = () => {
      if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) cancelMotion();
    };
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    document.addEventListener('visibilitychange', stop);
    media.addEventListener('change', stop);
    return () => {
      ++generation.current;
      cancelMotion();
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
      document.removeEventListener('visibilitychange', stop);
      media.removeEventListener('change', stop);
    };
  }, []);

  useLayoutEffect(() => {
    cancelMotion();
    if (active) {
      const url = new URL(location.href);
      if (url.hash !== surfCampaignHash) history.replaceState(history.state, '', `${url.pathname}${url.search}${surfCampaignHash}`);
      window.scrollTo({ top: 0, behavior: 'instant' });
      ref.current?.querySelector<HTMLElement>('#surf-campaign-title')?.focus({ preventScroll: true });
    } else if (hasOpened.current) {
      window.scrollTo({ top: dashboardPosition.current, behavior: 'instant' });
      const returnTarget = triggerKey.current ? ref.current?.querySelector<HTMLElement>(`[data-campaign-entry="${CSS.escape(triggerKey.current)}"]`) : ref.current?.querySelector<HTMLElement>('.renaiss-hub__brand');
      returnTarget?.focus({ preventScroll: true });
    }
    // Campaign entry belongs to its per-element viewport observer. The route
    // owns exits and overview entry, so two animations never target one piece.
    if (!active && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      pieces(active).forEach((element, index) => {
        const animation = run(element, [
          { opacity: .12, transform: 'translateY(8px)', filter: 'blur(3px)' },
          { opacity: 1, transform: 'none', filter: 'blur(0px)' },
        ], { duration: 500, delay: Math.min(index * 45, 180), easing: ease });
        const release = () => { animations.current.delete(animation); animation.cancel(); };
        animation.addEventListener('finish', release, { once: true });
      });
    }
    return cancelMotion;
  }, [active, revision]);

  function open() {
    triggerKey.current = document.activeElement?.getAttribute('data-campaign-entry') ?? null;
    location.hash = surfCampaignHash;
  }
  function back() { location.hash = '#portal-top'; }
  return { active, busy, revision, hasTransitioned: revision > 0, ref, open, back };
}
