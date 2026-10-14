import { defineShader, wgsl } from 'shaders/std';

// Only the pearl stage substrate is custom. The actual Aurora component supplies
// the moving light volume; this pass never draws a ring or a rainbow fringe.
export const surfAtmosphereDefinition = defineShader({
  name: 'SurfStageSubstrate',
  props: {
    travel: { default: 0 }, energy: { default: .035 },
    release: { default: 0 }, expansion: { default: 0 }, pulse: { default: 0 },
  },
  paint: wgsl`
    let p = (uv - vec2f(0.5)) * vec2f(aspect, 1.0);
    let drift = vec2f(sin(travel * 0.22), cos(travel * 0.17)) * 0.12;
    let ice = exp(-dot((p - vec2f(0.48, 0.27) - drift) * vec2f(1.0, 1.7),
      (p - vec2f(0.48, 0.27) - drift) * vec2f(1.0, 1.7)) * 2.0);
    let rose = exp(-dot((p - vec2f(-0.58, -0.12) + drift) * vec2f(1.0, 2.0),
      (p - vec2f(-0.58, -0.12) + drift) * vec2f(1.0, 2.0)) * 2.0);
    var color = vec3f(0.955, 0.949, 0.941);
    color = mix(color, vec3f(0.73, 0.85, 0.94), ice * (0.20 + energy * 0.20));
    color = mix(color, vec3f(0.95, 0.77, 0.83), rose * (0.18 + energy * 0.18));
    // One directional exposure follows the opening. No radial distance, rings,
    // prismatic fringe, particles or synthetic lens flare.
    let sweep = uv.x + uv.y * 0.24 - (-0.3 + expansion * 1.9);
    let exposure = exp(-sweep * sweep * 22.0) * release;
    color = mix(color, vec3f(1.0, 0.99, 0.97), exposure * 0.35);
    color += pulse * vec3f(0.10, 0.13, 0.15);
    return vec4f(color, 1.0);
  `,
});
