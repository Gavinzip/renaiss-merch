/** Shared low-cost, continuous turbulence; no raster textures or animation downloads. */
export const finaleNoise = /* glsl */ `
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
               mix(hash(i + vec2(0., 1.)), hash(i + vec2(1.)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.; float a = .5;
    mat2 r = mat2(.80, .60, -.60, .80);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p); p = r * p * 2.03 + 17.1; a *= .5;
    }
    return v;
  }
`
export const atmosphereVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`
