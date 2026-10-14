import { componentDefinition, type ComponentProps } from 'shaders/core/Aurora';

// The real library shader supplies the layered ray field and its independent
// animated clock. This module owns only palette, composition and phase props.
export const surfFieldDefinition = componentDefinition;
export const surfFieldProps = {
  colorA: '#6888d6', colorB: '#5bafab', colorC: '#d384a2',
  colorSpace: 'oklab', balance: 64, intensity: 85, curtainCount: 3,
  speed: 8, waviness: 150, rayDensity: 85, height: 100,
  center: { x: .5, y: .56 }, seed: 8,
} satisfies ComponentProps;

export function sampleSurfField(energy: number, gather: number, release: number, moving: boolean) {
  return {
    speed: moving ? (6 + energy * 4) * (1 - gather * .97) : release * 8,
    waviness: 100 + energy * 60 - gather * 35 + release * 25,
    intensity: 65 + energy * 25 + release * 12,
    height: 90 + energy * 20 + release * 40,
    // Let the existing curtains rise gently with the opening. Avoid a sudden
    // shift of the curtain base or squeezing the entire field into the floor.
    center: { x: .5, y: .56 + release * .035 },
  };
}
