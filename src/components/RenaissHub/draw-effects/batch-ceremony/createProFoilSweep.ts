import * as THREE from 'three';

/** A brief moving softbox, evaluated by the foil's existing physical BRDF. */
export function createProFoilSweep(materials: THREE.MeshPhysicalMaterial[]) {
  const light = { value: new THREE.Vector2(-2, 0) };
  for (const material of materials) {
    material.onBeforeCompile = shader => {
      shader.uniforms.uFoilSweep = light;
      shader.fragmentShader = 'uniform vec2 uFoilSweep;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        if (uFoilSweep.y > 0.0) {
          for (int sampleIndex = -1; sampleIndex <= 1; sampleIndex++) {
            vec3 sweepDirection = normalize(vec3(uFoilSweep.x + float(sampleIndex) * .12, .25, 1.0));
            vec3 sweepIrradiance = vec3(uFoilSweep.y / 3.0 * max(dot(geometryNormal, sweepDirection), 0.0));
            reflectedLight.directSpecular += sweepIrradiance * BRDF_GGX(sweepDirection, geometryViewDir, geometryNormal, material);
          }
        }`);
    };
    material.customProgramCacheKey = () => 'foil-softbox-sweep-v1';
  }
  return (time: number) => {
    const progress = (time % 8.6 - 6.8) / 1.6;
    const strength = progress > 0 && progress < 1 ? Math.sin(Math.PI * progress) ** 2 * .05 : 0;
    light.value.set(-1.6 + 3.2 * progress, strength);
  };
}
