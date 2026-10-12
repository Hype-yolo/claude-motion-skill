import * as THREE from 'three';

/**
 * Street lamp light on the outdoor surfaces at night, without real point lights (dozens of them would
 * make every fragment of the scene loop over them): the ground materials add a warm pool around each
 * lamp in their shader. Uniforms are shared, so one update reaches every patched material.
 */

export const MAX_LAMPS = 96;

export const lampUniforms = {
  /** x, z and radius of each pool. */
  lampData: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
  lampCount: { value: 0 },
  /** 0 by day, up to about 1.5 at night. */
  lampStrength: { value: 0 },
};

export function setLampPools(pools: { x: number; z: number; radius: number }[]): void {
  const count = Math.min(pools.length, MAX_LAMPS);
  for (let i = 0; i < count; i++)
    lampUniforms.lampData.value[i]!.set(pools[i]!.x, pools[i]!.z, pools[i]!.radius);
  lampUniforms.lampCount.value = count;
}

/** Makes a standard material receive the lamp pools. */
export function withLampLight<T extends THREE.MeshStandardMaterial>(material: T): T {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, lampUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLampWorld;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvLampWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vLampWorld;
uniform vec3 lampData[${MAX_LAMPS}];
uniform int lampCount;
uniform float lampStrength;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `if (lampStrength > 0.0) {
  float lampGlow = 0.0;
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    if (i >= lampCount) break;
    float falloff = 1.0 - smoothstep(0.0, lampData[i].z, distance(vLampWorld.xz, lampData[i].xy));
    lampGlow += falloff * falloff;
  }
  outgoingLight += diffuseColor.rgb * vec3(1.0, 0.8, 0.52) * lampGlow * lampStrength;
}
#include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => 'lamp-light';
  return material;
}
