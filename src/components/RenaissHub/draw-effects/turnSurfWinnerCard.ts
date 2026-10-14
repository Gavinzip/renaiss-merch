// The parked card keeps its real DOM artwork through the entire turn. Both
// faces share one stable grid cell, so names cannot shift neighbouring cards.
export function turnSurfWinnerCard(element: HTMLElement, onFinish: () => void) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animation = element.animate([
    { transform: 'translateY(0) rotateY(0deg)', offset: 0 },
    { transform: 'translateY(-4px) rotateY(-12deg)', offset: .18 },
    { transform: 'translateY(-8px) rotateY(-128deg)', offset: .62 },
    { transform: 'translateY(0) rotateY(-180deg)', offset: 1 },
  ], { duration: reduced.matches ? 0 : 820, easing: 'cubic-bezier(.35,0,.2,1)', fill: 'both' });
  const preferenceChanged = () => { if (reduced.matches) animation.finish(); };
  reduced.addEventListener('change', preferenceChanged);
  animation.onfinish = onFinish;
  return { cancel() { animation.onfinish = null; animation.cancel(); reduced.removeEventListener('change', preferenceChanged); } };
}
