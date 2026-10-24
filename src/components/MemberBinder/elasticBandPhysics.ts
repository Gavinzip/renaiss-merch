// A damped, pinned string. Each section transfers tension to its neighbours,
// so a released pull travels along the band instead of easing as a rigid bar.
export const BAND_SEGMENTS = 24;
export type ElasticNode = { offset: number; velocity: number };
export type ElasticPull = { position: number; offset: number };
export function createElasticBand(): ElasticNode[] {
  return Array.from({ length: BAND_SEGMENTS + 1 }, () => ({
    offset: 0,
    velocity: 0,
  }));
}
export function stepElasticBand(
  nodes: ElasticNode[],
  seconds: number,
  pull: ElasticPull | null,
) {
  const steps = Math.max(1, Math.ceil(seconds / (1 / 180)));
  const dt = Math.min(seconds, 0.04) / steps;
  for (let step = 0; step < steps; step++) {
    const accelerations = nodes.map((node, i) => {
      if (i === 0 || i === BAND_SEGMENTS) return 0;
      const tension =
        (nodes[i - 1].offset + nodes[i + 1].offset - 2 * node.offset) * 1500;
      const influence = pull
        ? Math.max(0, 1 - Math.abs(i / BAND_SEGMENTS - pull.position) * 9)
        : 0;
      return (
        tension -
        node.offset * 40 -
        node.velocity * 7 +
        influence * (pull ? (pull.offset - node.offset) * 1800 : 0)
      );
    });
    nodes.forEach((node, i) => {
      if (i === 0 || i === BAND_SEGMENTS) {
        node.offset = 0;
        node.velocity = 0;
      } else {
        node.velocity += accelerations[i] * dt;
        node.offset += node.velocity * dt;
      }
    });
  }
  return nodes.some(
    (node) => Math.abs(node.offset) > 0.04 || Math.abs(node.velocity) > 0.2,
  );
}
export function elasticBandPath(
  nodes: ElasticNode[],
  x: number,
  height: number,
) {
  const coordinates = nodes.map((node, i) => [
    x + node.offset,
    (i * height) / BAND_SEGMENTS,
  ]);
  let path = `M${coordinates[0][0]} 0`;
  for (let i = 1; i < coordinates.length - 1; i++) {
    const a = coordinates[i],
      b = coordinates[i + 1];
    path += `Q${a[0].toFixed(2)} ${a[1].toFixed(2)} ${((a[0] + b[0]) / 2).toFixed(2)} ${((a[1] + b[1]) / 2).toFixed(2)}`;
  }
  return path + `L${x} ${height}`;
}
