/**
 * Three.js ports of the FrenchBuilding.blend materials.
 *
 * The module meshes carry no UVs: every surface material in the .blend is a
 * world-space triplanar projection (Geometry.Position × scale, blend weights
 * |N|⁴ normalized) of an ambientCG set — color, roughness mapped into a range,
 * displacement into a Bump node — tinted, then optionally darkened by a
 * vertical-streak FBM grime ramp. That graph is rebuilt here by injecting GLSL
 * into MeshStandard/MeshPhysical materials, so they keep three's lighting,
 * shadows and the weather shaders (wet.ts chains onto these hooks).
 * Blender-only terms (Ambient Occlusion / Bevel shader nodes) are omitted.
 *
 * FR_Glass, FR_Interior (room atlas) and FR_Voile (opaque curtains) are rebuilt
 * as their own small materials.
 */
import {
  Color, DoubleSide, LinearMipmapLinearFilter, Material, MeshBasicMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader, Vector3, ClampToEdgeWrapping,
} from "three";

export interface TriplanarSpec {
  tex: string; // public/assets/tex/<tex>_color.jpg + <tex>_rd.png
  scale: number; // Vector Math SCALE on Geometry.Position
  tint: [number, number, number]; // Mix (MULTIPLY) B color
  tintMix: number; // Mix.001 factor
  rough: [number, number]; // Map Range To Min / To Max
  bump: number; // Bump strength (distance 0.02)
  metalness?: number;
  grime?: { ramp: [number, number, number]; mix: number }; // Color Ramp 0.45 → 0.75
  verticalDarken?: [number, number, number]; // FR_Stone: Mix.002 by (1 − w.z)
  zinc?: boolean; // FR_Zinc: luminance-normalized variation × tint
  clearcoat?: [number, number]; // Coat weight / roughness
}

/** per-material parameters, straight from the .blend node values */
export const SPECS: Record<string, TriplanarSpec> = {
  FR_Stone: {
    tex: "stone", scale: 0.5, tint: [0.86, 0.78, 0.64], tintMix: 0.85, rough: [0.7, 0.95], bump: 0.35,
    grime: { ramp: [0.72, 0.68, 0.62], mix: 0.8 }, verticalDarken: [0.55, 0.5, 0.45],
  },
  FR_StoneTrim: {
    tex: "trim", scale: 0.8333, tint: [0.9, 0.83, 0.7], tintMix: 0.85, rough: [0.65, 0.9], bump: 0.25,
    grime: { ramp: [0.72, 0.68, 0.62], mix: 0.6 },
  },
  FR_Zinc: {
    tex: "zinc", scale: 0.6667, tint: [0.2283, 0.25, 0.2826], tintMix: 1, rough: [0.45, 0.7], bump: 0.1,
    metalness: 0.15, grime: { ramp: [0.8, 0.82, 0.85], mix: 0.35 }, zinc: true,
  },
  FR_WindowFrame: {
    tex: "frame", scale: 1.25, tint: [0.88, 0.86, 0.8], tintMix: 0.6, rough: [0.35, 0.55], bump: 0.15,
  },
  FR_Iron: {
    tex: "iron", scale: 2, tint: [0.05, 0.05, 0.055], tintMix: 0.7, rough: [0.35, 0.6], bump: 0.15, metalness: 0.6,
  },
  FR_DoorWood: {
    tex: "door", scale: 1, tint: [1, 1, 1], tintMix: 0, rough: [0.25, 0.45], bump: 0.2, clearcoat: [0.4, 0.15],
  },
};

// --- GLSL -------------------------------------------------------------------

const TRI_VERT_PARS = /* glsl */ `
varying vec3 vTriP;
varying vec3 vTriN;
`;

const TRI_VERT = /* glsl */ `
#ifdef USE_INSTANCING
  vTriP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
  vTriN = mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal;
#else
  vTriP = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vTriN = mat3(modelMatrix) * objectNormal;
#endif
`;

/** 3D gradient noise → Blender-style normalized FBM in [0,1] */
const NOISE_GLSL = /* glsl */ `
vec3 triHash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float triPerlin(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(mix(dot(triHash3(i), f),
                     dot(triHash3(i + vec3(1, 0, 0)), f - vec3(1, 0, 0)), u.x),
                 mix(dot(triHash3(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)),
                     dot(triHash3(i + vec3(1, 1, 0)), f - vec3(1, 1, 0)), u.x), u.y),
             mix(mix(dot(triHash3(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)),
                     dot(triHash3(i + vec3(1, 0, 1)), f - vec3(1, 0, 1)), u.x),
                 mix(dot(triHash3(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)),
                     dot(triHash3(i + vec3(1, 1, 1)), f - vec3(1, 1, 1)), u.x), u.y), u.z);
}
// Noise Texture (FBM, detail 6, roughness 0.5, lacunarity 2, normalize)
float triFbm(vec3 p) {
  float sum = 0.0, amp = 1.0, maxAmp = 0.0;
  for (int i = 0; i < 6; i++) { sum += triPerlin(p) * amp; maxAmp += amp; amp *= 0.5; p *= 2.0; }
  return 0.5 * sum / maxAmp * 1.6 + 0.5; // ×1.6 ≈ Blender's perlin output range
}
`;

const TRI_FRAG_PARS = /* glsl */ `
varying vec3 vTriP;
varying vec3 vTriN;
uniform sampler2D uTriColor;
uniform sampler2D uTriRD;
uniform float uTriScale;
uniform vec3 uTriTint;
uniform float uTriTintMix;
uniform vec2 uTriRough;
uniform float uTriBump;
uniform vec3 uTriGrime;
uniform float uTriGrimeMix;
uniform vec3 uTriDarken;
${NOISE_GLSL}
// Mikkelsen surface-gradient bump (same as three's perturbNormalArb)
vec3 triPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
  vec3 vSigmaX = normalize(dFdx(surfPos.xyz));
  vec3 vSigmaY = normalize(dFdy(surfPos.xyz));
  vec3 vN = surfNorm;
  vec3 R1 = cross(vSigmaY, vN);
  vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surfNorm - vGrad);
}
`;

const TRI_MAP = /* glsl */ `
  // Blender Z-up world coordinates (the building root maps Blender → three as (x, z, −y))
  vec3 triWorld = vec3(vTriP.x, -vTriP.z, vTriP.y);
  vec3 triNrm = normalize(vec3(vTriN.x, -vTriN.z, vTriN.y));
  vec3 triW = triNrm * triNrm; triW *= triW;
  triW /= dot(triW, vec3(1.0));
  vec3 triP = triWorld * uTriScale;
  vec3 triCol = texture2D(uTriColor, triP.yz).rgb * triW.x
              + texture2D(uTriColor, triP.xz).rgb * triW.y
              + texture2D(uTriColor, triP.xy).rgb * triW.z;
  vec2 triRD = texture2D(uTriRD, triP.yz).rg * triW.x
             + texture2D(uTriRD, triP.xz).rg * triW.y
             + texture2D(uTriRD, triP.xy).rg * triW.z;
#ifdef TRI_ZINC
  // RGB to BW ÷ texture mean (0.0149), half contrast, × zinc reference colour
  float triLum = dot(triCol, vec3(0.2126, 0.7152, 0.0722));
  vec3 triC = (triLum / 0.0149 * 0.5 + 0.5) * uTriTint;
#else
  vec3 triC = mix(triCol, triCol * uTriTint, uTriTintMix);
#endif
#ifdef TRI_DARKEN
  triC = mix(triC, triC * uTriDarken, 1.0 - triW.z);
#endif
#ifdef TRI_GRIME
  float triN = triFbm(triWorld * vec3(1.2, 1.2, 0.07) * 3.0);
  vec3 triRamp = mix(vec3(1.0), uTriGrime, clamp((triN - 0.45) / 0.3, 0.0, 1.0));
  triC = mix(triC, triC * triRamp, uTriGrimeMix);
#endif
  diffuseColor.rgb *= triC;
`;

const TRI_ROUGH = /* glsl */ `
  roughnessFactor = mix(uTriRough.x, uTriRough.y, clamp(triRD.x, 0.0, 1.0));
`;

const TRI_NORMAL = /* glsl */ `
  {
    float triH = triRD.y * 0.02; // Bump distance
    vec3 triBumped = triPerturb(-vViewPosition, normal, vec2(dFdx(triH), dFdy(triH)), faceDirection);
    normal = normalize(mix(normal, triBumped, uTriBump));
  }
`;

// --- loaders ------------------------------------------------------------------

const loader = new TextureLoader();
const texCache = new Map<string, Promise<Texture>>();

function loadTex(url: string, srgb: boolean, repeat = true): Promise<Texture> {
  const key = url + srgb;
  let p = texCache.get(key);
  if (!p) {
    p = loader.loadAsync(url).then(t => {
      t.colorSpace = srgb ? SRGBColorSpace : "";
      t.wrapS = t.wrapT = repeat ? RepeatWrapping : ClampToEdgeWrapping;
      t.minFilter = LinearMipmapLinearFilter;
      t.anisotropy = 8;
      return t;
    });
    texCache.set(key, p);
  }
  return p;
}

/** world-space triplanar PBR material — the building surfaces, and the studio floor */
export async function triplanar(name: string, spec: TriplanarSpec, base: string): Promise<MeshStandardMaterial> {
  const [color, rd] = await Promise.all([
    loadTex(`${base}tex/${spec.tex}_color.jpg`, true),
    loadTex(`${base}tex/${spec.tex}_rd.png`, false),
  ]);
  const params = { name, color: 0xffffff, roughness: 1, metalness: spec.metalness ?? 0 };
  const mat = spec.clearcoat
    ? new MeshPhysicalMaterial({ ...params, clearcoat: spec.clearcoat[0], clearcoatRoughness: spec.clearcoat[1] })
    : new MeshStandardMaterial(params);

  const uniforms = {
    uTriColor: { value: color },
    uTriRD: { value: rd },
    uTriScale: { value: spec.scale },
    uTriTint: { value: new Vector3(...spec.tint) },
    uTriTintMix: { value: spec.tintMix },
    uTriRough: { value: spec.rough },
    uTriBump: { value: spec.bump },
    uTriGrime: { value: new Vector3(...(spec.grime?.ramp ?? [1, 1, 1])) },
    uTriGrimeMix: { value: spec.grime?.mix ?? 0 },
    uTriDarken: { value: new Vector3(...(spec.verticalDarken ?? [1, 1, 1])) },
  };
  const defines: Record<string, string> = {};
  if (spec.zinc) defines.TRI_ZINC = "";
  if (spec.grime) defines.TRI_GRIME = "";
  if (spec.verticalDarken) defines.TRI_DARKEN = "";

  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.defines = { ...shader.defines, ...defines };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\n" + TRI_VERT_PARS)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + TRI_VERT);
    // each block goes directly after its anchor include; wet.ts relies on this
    // ordering (it injects first, so these land before the wet adjustments)
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + TRI_FRAG_PARS)
      .replace("#include <map_fragment>", "#include <map_fragment>\n" + TRI_MAP)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n" + TRI_ROUGH)
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n" + TRI_NORMAL);
  };
  mat.customProgramCacheKey = () => "fr-triplanar|" + Object.keys(defines).join(",");
  return mat;
}

/**
 * FR_Glass: Mix Shader(Transparent, Glossy) by Layer Weight Fresnel (blend 0.18)
 * + 0.03. Rendered premultiplied: glossy · F over the background · (1 − F).
 */
function glass(): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({
    name: "FR_Glass",
    color: new Color(0.8, 0.8, 0.8),
    metalness: 1,
    roughness: 0.03,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
  });
  mat.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `{
        // Layer Weight fresnel = dielectric fresnel with eta = 1 / (1 − blend)
        float eta = 1.0 / (1.0 - 0.18);
        float c = abs(dot(normalize(vViewPosition), normal));
        float g = sqrt(max(eta * eta - 1.0 + c * c, 0.0));
        float A = (g - c) / (g + c);
        float B = (c * (g + c) - 1.0) / (c * (g - c) + 1.0);
        float F = 0.5 * A * A * (1.0 + B * B);
        diffuseColor.a = clamp(F + 0.03, 0.0, 1.0);
      }
      #include <opaque_fragment>`,
    );
  };
  mat.customProgramCacheKey = () => "fr-glass";
  return mat;
}

/**
 * FR_Interior: emission-only room shader. room_local is the vertex position in
 * the room's frame; p1..p3 carry the photo pick (see interiors.ts). The photo is
 * projected with a 16 m pinhole so the back wall shrinks with depth.
 */
async function interior(base: string): Promise<MeshBasicMaterial & { userData: { gain: { value: number } } }> {
  const atlas = await loadTex(`${base}tex/interiors.jpg`, true, false);
  const mat = new MeshBasicMaterial({ name: "FR_Interior", side: DoubleSide }) as MeshBasicMaterial & {
    userData: { gain: { value: number } };
  };
  mat.userData.gain = { value: 2.2 }; // Emission "EXPOSURE" multiplier
  mat.onBeforeCompile = shader => {
    shader.uniforms.uInteriorGain = mat.userData.gain;
    shader.uniforms.uAtlas = { value: atlas };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute vec3 room_local; attribute vec3 room_p1; attribute vec3 room_p2; attribute vec3 room_p3;
        varying vec3 vRoomLocal; varying vec3 vP1; varying vec3 vP2; varying vec3 vP3;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vRoomLocal = room_local; vP1 = room_p1; vP2 = room_p2; vP3 = room_p3;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vRoomLocal; varying vec3 vP1; varying vec3 vP2; varying vec3 vP3;
        uniform float uInteriorGain; uniform sampler2D uAtlas;`,
      )
      .replace(
        "#include <map_fragment>",
        `{
          float persp = 16.0 / (vRoomLocal.y + 16.0);
          float u = 0.5 + (vRoomLocal.x - vP1.y) * persp / (vP1.z * vP1.x);
          float v = 0.5 + (vRoomLocal.z - vP1.x * 0.5) * persp / vP1.x;
          u = clamp(u * (1.0 - vP3.y) + (1.0 - u) * vP3.y, 0.0, 1.0); // mirrored photos
          v = clamp(v, 0.0, 1.0);
          vec3 photo = texture2D(uAtlas, vec2(vP2.x + u * vP2.z, vP2.y + v * vP3.x)).rgb;
          vec3 warm = vP3.z > 0.95 ? vec3(1.0, 0.72, 0.45) : vec3(1.0); // lamps on
          float falloff = mix(1.0, 0.55, clamp(vRoomLocal.y / 4.5, 0.0, 1.0));
          diffuseColor.rgb = photo * warm * vP3.z * falloff * uInteriorGain;
        }`,
      );
  };
  mat.customProgramCacheKey = () => "fr-interior";
  return mat;
}

/**
 * FR_Voile: opaque cotton curtain — Principled BSDF, base color (0.78, 0.74, 0.66),
 * roughness 0.9, sheen 0.5 (sheen roughness 0.4), no transmission / alpha.
 * The .blend's 180× wave-band bump (a fine weave) is below pixel scale here.
 */
function voile(): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    name: "FR_Voile",
    color: new Color(0.78, 0.74, 0.66),
    roughness: 0.9,
    sheen: 0.5,
    sheenRoughness: 0.4,
    sheenColor: new Color(1, 1, 1),
    side: DoubleSide,
  });
}

export interface BuildingMaterials {
  byName: Map<string, Material>;
  glass: MeshStandardMaterial;
  interior: MeshBasicMaterial & { userData: { gain: { value: number } } };
  voile: MeshPhysicalMaterial;
  /** the triplanar surface materials (weather targets) */
  surfaces: MeshStandardMaterial[];
}

export async function createMaterials(base: string): Promise<BuildingMaterials> {
  const entries = await Promise.all(Object.entries(SPECS).map(([n, s]) => triplanar(n, s, base)));
  const byName = new Map<string, Material>(entries.map(m => [m.name, m]));
  const g = glass();
  byName.set(g.name, g);
  return { byName, glass: g, interior: await interior(base), voile: voile(), surfaces: entries };
}
