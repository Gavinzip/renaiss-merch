export const volumeVertex = /* glsl */ `
  out vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
`

/** World-space, fixed-step transport. No screen-pixel random jitter or frame-dependent noise. */
export const volumeFragment = /* glsl */ `
  precision highp sampler3D;
  in vec2 vUv;
  out vec4 outColor;
  uniform sampler2D tDepth;
  uniform sampler3D tNoise;
  uniform mat4 inverseProjection, cameraWorld;
  uniform vec3 eye;
  uniform vec3 prizeCenter;
  uniform float prizeRotation;
  uniform float copyProtection;
  uniform float time, strength, firePower, emergence, impact, ground;

  float field(vec3 p) { return texture(tNoise, p).r; }
  float plumeDistance(vec2 p) {
    float front = min(length((p - vec2(-2.65, .65)) * vec2(.85, 1.4)), length((p - vec2(2.7, .1)) * vec2(.95, 1.6)));
    float rear = min(length((p - vec2(-2.3, -4.1)) * vec2(.82, 1.3)), length((p - vec2(2.1, -4.7)) * vec2(.9, 1.35)));
    return min(front, rear);
  }
  float flameEnvelope(vec2 p, float height) {
    // Distinct heights and thin elliptical fuel beds avoid four identical luminous cones.
    float a = length((p - vec2(-2.65, .65)) * vec2(1., 1.8)) + height / 3.3;
    float b = length((p - vec2(2.7, .1)) * vec2(1.2, 1.9)) + height / 4.2;
    float c = length((p - vec2(-2.3, -4.1)) * vec2(.95, 1.7)) + height / 5.2;
    float d = length((p - vec2(2.1, -4.7)) * vec2(1.1, 1.65)) + height / 4.7;
    return min(min(a, b), min(c, d));
  }
  vec2 densities(vec3 p, out float heat, out float shading) {
    // Smoke/fire flow around the sealed carton instead of appearing inside its clear window.
    vec3 local = p - prizeCenter;
    float c = cos(prizeRotation), s = sin(prizeRotation);
    local.xz = mat2(c, s, -s, c) * local.xz;
    vec3 box = abs(local) - vec3(1.54, 1.54, 1.19);
    float clearance = length(max(box, vec3(0.))) + min(max(box.x, max(box.y, box.z)), 0.);
    float outside = smoothstep(.035, .24, clearance);
    if (outside <= 0.) { heat = 0.; shading = 0.; return vec2(0.); }
    float height = max(0., p.y - ground);
    vec3 flow = p * .12 + vec3(time * .004, -time * .028, time * .003);
    float coarse = field(flow);
    float detail = field(p * vec3(.35, .2, .35) + vec3(.1, -time * .075, .2));
    float billow = smoothstep(.29, .73, coarse * .66 + detail * .34);
    float spread = 1.8 + emergence * 1.1;
    float sides = exp(-pow((abs(p.x) - spread) / 1.05, 2.)) * exp(-pow((p.z + 1.5) / 3.5, 2.));
    float veil = exp(-pow((p.z + 2.2) / 1.1, 2.)) * exp(-p.x * p.x * .075) * (1. - emergence);
    float rear = exp(-pow((p.z + 6.) / 2., 2.)) * exp(-p.x * p.x * .07);
    float smoke = (veil * 2.6 + sides * .6 + rear * .6) * billow * smoothstep(0., .4, height) * (1. - smoothstep(3.6, 7., height)) * strength;
    shading = exp(-max(0., field(flow + vec3(-.045, .05, .02)) - .28) * 6.);

    heat = 0.;
    float flame = 0.;
    if (height < 6.5 && plumeDistance(p.xz) < 2.1) {
      // Advection stretches coherent tongues upwards. High-frequency turbulence only breaks their edges.
      vec3 flameFlow = p * vec3(.45, .24, .45) + vec3(.05, -time * .25, .21);
      float roll = field(flameFlow);
      float fold = field(flameFlow * 2.17 + vec3(.31, -time * .095, .17));
      float fray = field(flameFlow * 4.1 + vec3(.4, -time * .16, .7));
      vec2 bend = vec2(roll - .5, coarse - .5) * (.2 + height * .5);
      float envelope = flameEnvelope(p.xz + bend, height / (1. + impact * .2));
      float fuel = 1.03 - envelope + (roll - .5) * .85 + (fold - .5) * .55 + (fray - .5) * .2;
      float edge = smoothstep(-.025, .07, fuel);
      float filament = .2 + .8 * smoothstep(.2, .76, fold);
      flame = edge * filament * smoothstep(0., .12, height) * firePower;
      heat = clamp(fuel * 1.35 + (1. - height / 6.) * .12, 0., 1.);
    }
    return vec2(smoke, flame) * outside;
  }
  void main() {
    // The copy column is already fully protected. Do not march 112 samples and
    // six noise reads per sample only to discard their result at the end.
    float visibility = mix(1., 1. - smoothstep(.41, .49, vUv.x), copyProtection);
    if (visibility < .001 || strength < .001) { outColor = vec4(0., 0., 0., 1.); return; }
    vec4 farView = inverseProjection * vec4(vUv * 2. - 1., 1., 1.);
    vec3 ray = normalize((cameraWorld * vec4(farView.xyz / farView.w, 1.)).xyz - eye);
    vec4 depthView = inverseProjection * vec4(vUv * 2. - 1., texture(tDepth, vUv).r * 2. - 1., 1.);
    float sceneDistance = length((cameraWorld * vec4(depthView.xyz / depthView.w, 1.)).xyz - eye);
    vec3 nearPlane = (vec3(-6.5, ground + .01, -9.) - eye) / ray;
    vec3 farPlane = (vec3(6.5, 6., 3.1) - eye) / ray;
    vec3 entry = min(nearPlane, farPlane), leave = max(nearPlane, farPlane);
    float start = max(0., max(entry.x, max(entry.y, entry.z)));
    float end = min(sceneDistance, min(leave.x, min(leave.y, leave.z)));
    if (start >= end || strength < .001) { outColor = vec4(0., 0., 0., 1.); return; }
    // A moving surface changes only the last partial segment, not every sample along the ray.
    const float stride = .16;
    float transmittance = 1.;
    vec3 scattered = vec3(0.);
    for (int i = 0; i < 112; i++) {
      float distance = start + float(i) * stride;
      if (distance >= end) break;
      float segment = min(stride, end - distance);
      vec3 p = eye + ray * (distance + segment * .5);
      float heat, shade;
      vec2 density = densities(p, heat, shade);
      float extinction = density.x + density.y * .32;
      float absorption = 1. - exp(-extinction * segment);
      float localFire = exp(-plumeDistance(p.xz) * 1.1) * firePower;
      vec3 smokeLight = vec3(.023, .03, .043) * (.2 + shade) + vec3(.12, .032, .006) * localFire * (.18 + shade * shade);
      // Thin orange edges surround a bright amber core; soot remains dark instead of glowing yellow.
      vec3 fireLight = mix(vec3(1.8, .06, .001), vec3(4., 1.3, .09), smoothstep(.05, .48, heat));
      fireLight = mix(fireLight, vec3(6., 3.7, 1.1), smoothstep(.5, .95, heat));
      vec3 source = smokeLight * density.x + fireLight * density.y;
      scattered += transmittance * source * absorption / max(extinction, .0001);
      transmittance *= 1. - absorption;
      if (transmittance < .015) break;
    }
    // During the desktop handoff, reserve the DOM copy column. Geometry is never masked.
    outColor = vec4(scattered * visibility, mix(1., transmittance, visibility));
  }
`
