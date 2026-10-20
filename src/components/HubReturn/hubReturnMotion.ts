import './HubReturnMotion.css';

const archivePieces = '.pokemon-header, .pokemon-scroll-story__copy, .pokemon-scroll-story__prizes, .pokemon-winners__intro, .pokemon-winners-ledger, .pokemon-winners__standard, .pokemon-winners__bonus, .pokemon-extra-winners, .pokemon-rules, .pokemon-archive-footer, .control-header, .hero-copy, .winner-stage-primary, .winner-stage-actions, .winner-round-simulator';
const hubPieces = '.hub-site-header, .hub-event-archive__intro, .hub-event-archive__collection-label, .hub-event-archive__card, .hub-event-archive__collection-footer';
let navigationPending: Promise<void> | null = null;
const activeAnimations = new Set<Animation>();

function resetHandoff() {
  navigationPending = null;
  activeAnimations.forEach(animation => animation.cancel());
  activeAnimations.clear();
  delete document.documentElement.dataset.hubReturn;
  document.getElementById('hub-return-veil')?.remove();
}
function handleRestore(event: PageTransitionEvent) { if (event.persisted) resetHandoff(); }
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function settleReducedMotion() {
  if (!reducedMotion.matches) return;
  activeAnimations.forEach(animation => animation.finish());
}
window.addEventListener('pageshow', handleRestore);
reducedMotion.addEventListener('change', settleReducedMotion);
if (import.meta.hot) import.meta.hot.dispose(() => {
  resetHandoff();
  window.removeEventListener('pageshow', handleRestore);
  reducedMotion.removeEventListener('change', settleReducedMotion);
});

function motionValues(root: HTMLElement) {
  const css = getComputedStyle(root);
  const duration = css.getPropertyValue('--page-slide-dur').trim();
  const milliseconds = parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000);
  const distance = parseFloat(css.getPropertyValue('--page-slide-distance'));
  const blur = parseFloat(css.getPropertyValue('--page-blur'));
  const easing = css.getPropertyValue('--page-slide-ease').trim();
  if (![milliseconds, distance, blur].every(Number.isFinite) || !easing) throw new Error('Missing Hub return motion tokens');
  return { duration: milliseconds, distance, blur, easing };
}

function animatePieces(root: HTMLElement, selector: string, entering: boolean) {
  const { duration, distance, blur, easing } = motionValues(root);
  return [...root.querySelectorAll<HTMLElement>(selector)]
    .filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0;
    }).map(element => {
      const rest = {opacity: 1, translate: '0 0', filter: 'blur(0px)'};
      const offset = {opacity: 0, translate: `${entering ? -distance : distance}px 0`, filter: `blur(${blur}px)`};
      const animation = element.animate(entering ? [offset, rest] : [rest, offset], {duration, easing, fill: 'both'});
      activeAnimations.add(animation);
      return animation;
    });
}

function createVeil() {
  const veil = document.createElement('div');
  veil.id = 'hub-return-veil';
  veil.className = 'hub-return-veil t-page-slide';
  veil.dataset.page = '2';
  veil.setAttribute('aria-hidden', 'true');
  const surface = document.createElement('div');
  surface.className = 't-page';
  surface.dataset.pageId = '1';
  veil.append(surface);
  document.body.append(veil);
  return veil;
}

export function returnToHub(href: string) {
  if (navigationPending) return navigationPending;
  navigationPending = (async () => {
    const target = new URL(href, location.origin);
    target.searchParams.set('hubReturn', '1');
    const veil = createVeil();
    document.documentElement.dataset.hubReturn = 'leaving';
    // Commit the hidden initial state before changing the recipe's data-page.
    getComputedStyle(veil.firstElementChild!).opacity;
    veil.dataset.page = '1';
    getComputedStyle(veil.firstElementChild!).opacity;
    const pieces = animatePieces(document.body, archivePieces, false);
    await Promise.allSettled([...pieces, ...veil.getAnimations({subtree:true})].map(animation => animation.finished));
    location.assign(target.href);
  })();
  return navigationPending;
}

export function revealHubAfterReturn(root: HTMLElement) {
  const veil = document.getElementById('hub-return-veil');
  if (document.documentElement.dataset.hubReturn !== 'arriving' || !veil) return () => {};
  let started = false;
  const frame = requestAnimationFrame(() => {
    started = true;
    const url = new URL(location.href);
    url.searchParams.delete('hubReturn');
    history.replaceState(history.state, '', url);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { resetHandoff(); return; }
    document.documentElement.dataset.hubReturn = 'revealing';
    getComputedStyle(veil.firstElementChild!).opacity;
    const pieces = animatePieces(root, hubPieces, true);
    veil.dataset.page = '2';
    getComputedStyle(veil.firstElementChild!).opacity;
    void Promise.allSettled([...pieces, ...veil.getAnimations({subtree:true})].map(animation => animation.finished)).then(resetHandoff);
  });
  return () => { cancelAnimationFrame(frame); if (started) resetHandoff(); };
}
