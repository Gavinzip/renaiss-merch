import { componentDefinition, type ComponentProps } from 'shaders/core/BrushedMetal';

// One actual BrushedMetal surface. The SVG's 720×472 coordinates stay aligned
// with this analytic shape; the official logo and type remain separate artwork.
export const surfProMetalDefinition = componentDefinition;
export const surfProMetalProps = {
  center: { x: .5, y: 228 / 472 },
  scale: 1,
  shape: JSON.stringify({ type: 'roundedRectSDF', radius: 338 / 472, height: 208 / 472, rounding: 22 / 472 }),
  shapeType: 'roundedRectSDF',
  lightColor: '#fafaf5',
  darkColor: '#aeb8b4',
  brushAngle: 0,
  anisotropy: .32,
  grain: .22,
  grainScale: 3.2,
  roughness: .72,
  environment: .85,
  envRotation: 18,
  lightAngle: 215,
  bevelWidth: .008,
  bevelShape: .3,
  edgeSoftness: .7,
  speed: 0
} satisfies Partial<ComponentProps>;

export function surfProMetalLight(progress: number) {
  return { envRotation: 18 + progress * 48, lightAngle: 215 - progress * 24 };
}
