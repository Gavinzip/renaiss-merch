// The reference binder bends a leaf along its spine, rather than fading spreads.
// Keep the measured curve, shading and 860 ms cosine easing together.
export const TURN_MS = 860;
export function leafOrder(index: number, spread: number, count: number) {
  return index < spread ? index + 1 : count - index;
}
export function bendLeaf(leaf: HTMLElement, theta: number) {
  const wave = Math.sin(theta);
  leaf.style.transform = `rotateY(${(-180 * theta) / Math.PI}deg) scaleX(${1 - 0.06 * wave})`;
  leaf.style.setProperty("--shade", String(0.32 * wave));
  let front = "",
    back = "";
  if (wave >= 0.03) {
    type Point = [number, number];
    const bezier = (a: Point, b: Point, c: Point, t: number): Point => [
      (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0],
      (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1],
    ];
    const start: Point = [54, 0],
      control: Point = [92, 0],
      end: Point = [100 - 8 * wave, 3.2 * wave];
    const top: Point[] = [
      start,
      bezier(start, control, end, 0.35),
      bezier(start, control, end, 0.65),
      end,
    ];
    const bottom: Point = [end[0], 100 - end[1]],
      middle: Point = [100 - 8 * wave + 8.4 * wave, 50];
    const points: Point[] = [
      [0, 0],
      ...top,
      ...[0.25, 0.5, 0.75].map((t) => bezier(end, middle, bottom, t)),
      ...top.map(([x, y]): Point => [x, 100 - y]).reverse(),
      [0, 100],
    ];
    const polygon = (p: Point[]) =>
      `polygon(${p.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(",")})`;
    front = polygon(points);
    back = polygon(points.map(([x, y]) => [100 - x, y]));
  }
  const a = leaf.querySelector<HTMLElement>(":scope > .face--front");
  const b = leaf.querySelector<HTMLElement>(":scope > .face--back");
  if (a) a.style.clipPath = front;
  if (b) b.style.clipPath = back;
}
export function clearLeaf(leaf: HTMLElement) {
  leaf.classList.remove("dragging");
  leaf.style.removeProperty("transform");
  leaf.style.removeProperty("--shade");
  leaf
    .querySelectorAll<HTMLElement>(":scope > .face")
    .forEach((face) => face.style.removeProperty("clip-path"));
}
