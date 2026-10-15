import { defineShader, wgsl } from 'shaders/std';

// One studio light, driven by the card/input pose. No autonomous shader clock.
export const spotFoilShader = defineShader({
  name: 'RenaissSpotFoil',
  props: { light: { default: -.3 }, strength: { default: 0 }, angle: { default: 0 } },
  paint: wgsl`
    let axis = uv.x + uv.y * 0.32;
    let distance = axis - light;
    let reflection = exp(-distance * distance * 32.0);
    let glint = exp(-distance * distance * 850.0);
    let hue = clamp(uv.x * 0.65 + uv.y * 0.15 + angle * 0.2, 0.0, 1.0);
    var metal = mix(vec3f(0.20, 0.29, 0.42), vec3f(0.15, 0.33, 0.28), smoothstep(0.12, 0.5, hue));
    metal = mix(metal, vec3f(0.56, 0.42, 0.22), smoothstep(0.55, 0.95, hue));
    metal = mix(metal, vec3f(0.78, 0.84, 0.86), glint * 0.25);
    return vec4f(metal, reflection * strength);
  `,
});
