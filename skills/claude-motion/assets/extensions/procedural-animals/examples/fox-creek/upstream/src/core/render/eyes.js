// Eyes: eyeball meshes with a purpose-built shader and a small behaviour model, driven by the packed
// `data.eyes[i] = { side, bone, c, x, y, z, scale, spec, look }`.
//  * cornea: clear coat with scene reflections and sharp light catchlights (MeshPhysicalMaterial,
//    so every scene light, shadow, environment and fog applies);
//  * iris: procedural stroma (radial fibres, collarette, crypts, pupillary ruff, dark limbal ring)
//    seen THROUGH the cornea: the view ray is refracted at the corneal surface and traced to the
//    recessed iris plane, so the iris shifts with the viewing angle like a real eye;
//  * pupil (look.pupil): 'round', 'slit' (vertical: cats, foxes, snakes) or 'bar' (horizontal
//    rounded rectangle: goats, sheep, deer, horses, cattle, frogs); its size follows the light
//    (elevation of the scene's main directional light) and arousal within look.pupilSize [min, max];
//  * lids (look.lids): 'mammal' (almond aperture, lid-margin shading, blinking upper lid),
//    'bird' (a nictitating membrane sweeps across from the front corner; the lower lid rises for
//    sleep), 'none' (fish, snakes: no blinks, glossy spectacle), 'simple' (spiders: glossy black
//    domes, any number and size of eyes);
//  * behaviour: fixations with quick saccades, blinks every few seconds (sometimes double), gaze that
//    leads the head toward motion.state.lookTarget / input.look, motion.state.eyelid (0 open .. 1
//    shut) for sleep, half-lidded and still in death. Optional state: motion.state.eyeRoll (0..1, the
//    eyeball rolls back and shows its sclera: white shark biting), motion.state.nictitate (0..1, the
//    nictitating membrane closes: carcharhinid sharks); look.blink === false turns automatic blinks off.
//  * look.cornea (optional, default 1): strength of the cornea's clear coat. Under a bright sky the clear coat's
//    reflection can swamp a dark iris (a brown bear's eyes read pale blue-grey in the showcase); a species with
//    small, dark, deep-set eyes lowers it (bear 0.2) and keeps a small wet catchlight.
//  * look.envSpecular (optional, default 1): scale of the eyeball's environment (indirect) specular. three.js
//    replaces a standard material's envMapIntensity with scene.environmentIntensity whenever the scene has an
//    environment and the material has no env map of its own (WebGLRenderer), so the material's 0.28 below does not
//    apply in such scenes and a bright sky's sheen covers a dark iris (bear 0.2).
import * as THREE from 'three';

const PUPIL = { round: 0, slit: 1, bar: 2 };
const LIDS = { mammal: 0, bird: 1, none: 2, simple: 3 };
const PUPIL_SIZE = { round: [0.3, 0.5], slit: [0.07, 0.7], bar: [0.07, 0.42] };
const DEFAULT_IRIS = { inner: [0.2, 0.06, 0.007], mid: [0.54, 0.2, 0.022], hi: [0.78, 0.38, 0.055], outer: [0.26, 0.075, 0.009] };

const PARS = /* glsl */ `
uniform float uIrisZ, uIrisR, uPupil, uLensR, uLensD, uLensOff, uBlink, uLower, uNict, uLidTravel, uFront, uEnvSpec;
uniform float uRimShade, uLidShade, uLimbus, uLidSpec, uLidFur, uGlaze, uAmbient, uLidHair, uIrisLight, uEyeFill, uLidFlat, uLidSeam, uLidClump, uLidFill, uIrisTex, uLidMeet;
float gLidWrap = 0.0; // (look.lidFill) the coat's wrapped diffuse on a closing lid, set per fragment
uniform mat4 uSocketInv;
uniform vec3 uLidColor, uIrisIn, uIrisMid, uIrisHi, uIrisOut, uSclera;
varying vec3 vEyeObj; varying vec3 vCamObj; varying vec3 vEyeWorld; varying vec3 vIrisN;
float eh3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float evn3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(eh3(i), eh3(i + vec3(1, 0, 0)), f.x), mix(eh3(i + vec3(0, 1, 0)), eh3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(eh3(i + vec3(0, 0, 1)), eh3(i + vec3(1, 0, 1)), f.x), mix(eh3(i + vec3(0, 1, 1)), eh3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// noise sampled on circles around the pupil: periodic in angle, stretched along the radius
float irisN(float a, float r, float k, float kr, float o) { return evn3(vec3(cos(a) * k + o, sin(a) * k - o, r * kr)); }
// signed distance to the pupil edge in iris radii (< 0 inside)
float pupilSD(vec2 qn) {
#if PUPIL_TYPE == 1
  // vertical slit: a narrow lens pointed at top and bottom
  float w = uPupil, hh = 0.93;
  float R = (hh * hh + w * w) / (2.0 * w);
  vec2 p = abs(qn);
  return length(vec2(p.x + R - w, p.y)) - R;
#elif PUPIL_TYPE == 2
  // horizontal bar: rounded rectangle
  vec2 ext = vec2(0.58, uPupil);
  float rr = uPupil * 0.9;
  vec2 d = abs(qn) - ext + rr;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - rr;
#else
  return length(qn) - uPupil;
#endif
}
vec3 irisColor(vec2 q) {
  vec2 qn = q / uIrisR;
  float r = length(qn);
  float a = atan(q.y, q.x);
  float pd = pupilSD(qn);
  // radial fibre bundles at three scales
  float f1 = irisN(a, r, 24.0, 2.5, 0.0);
  float f2 = irisN(a, r, 9.0, 1.2, 7.3);
  float f3 = irisN(a, r, 55.0, 5.0, 3.1);
  float fib = f1 * 0.5 + f2 * 0.3 + f3 * 0.2;
  // wavy collarette ring and dark crypts in the mid stroma
  float cr = 0.53 + 0.06 * (irisN(a, 0.0, 3.0, 0.0, 1.7) - 0.5);
  float coll = smoothstep(0.045, 0.0, abs(r - cr));
  float crypt = smoothstep(0.64, 0.8, irisN(a, r, 14.0, 7.0, 9.1)) * smoothstep(0.5, 0.62, r) * (1.0 - smoothstep(0.84, 0.93, r));
  vec3 col = mix(uIrisIn, uIrisMid, smoothstep(0.36, 0.62, r));
  col = mix(col, uIrisHi, fib * 0.65 * smoothstep(0.42, 0.66, r) * (1.0 - smoothstep(0.8, 0.94, r)));
  col = mix(col, uIrisOut, smoothstep(0.78, 0.96, r));
  col *= mix(1.0, 0.72 + 0.56 * fib, uIrisTex); // (look.irisTexture: the contrast of the radial fibres and crypts)
  col = mix(col, col * 1.3 + 0.015, coll * 0.55);
  col *= 1.0 - crypt * 0.5 * uIrisTex;
  col *= mix(1.0, uLimbus, smoothstep(0.9, 1.0, r));                          // limbal ring
  col = mix(col, uIrisIn * 0.3 + 0.004, smoothstep(0.08, 0.01, pd));           // pupillary ruff
  float pw = fwidth(pd) + 0.004;
  col = mix(col, vec3(0.0025), smoothstep(pw, -pw, pd));                       // pupil
  return col;
}
float lensSD(vec2 p, float dUp, float dLo) { return max(length(p + vec2(0.0, dUp)) - uLensR, length(p - vec2(0.0, dLo)) - uLensR); }
`;

const MAP = /* glsl */ `
  // ---- iris seen through the cornea
  vec3 Pe = vEyeObj;
  vec3 Ne = normalize(Pe);
  vec3 Ve = normalize(Pe - vCamObj);
  float lidCover = 0.0, lidMargin = 0.0, eyeAO = 1.0, eyeLightOcc = 1.0, nictCover = 0.0;
  vec3 Sk = (uSocketInv * vec4(vEyeWorld, 1.0)).xyz;
  Sk.y -= uLensOff;
#if LID_TYPE == 3
  // simple glossy dome (spiders)
  diffuseColor.rgb = uIrisOut * 0.06 + 0.003;
#else
  float onCornea = smoothstep(uIrisZ - 0.00035, uIrisZ + 0.00035, Pe.z);
  vec3 Rr = refract(Ve, Ne, 1.0 / 1.376);
  float tI = (uIrisZ - Pe.z) / min(Rr.z, -0.05);
  vec2 qI = Pe.xy + Rr.xy * max(tI, 0.0);
  vec3 irisC = irisColor(qI);
  vec3 scl = uSclera * (0.55 + 0.45 * smoothstep(-0.002, 0.006, Pe.z));
  diffuseColor.rgb = mix(scl, irisC, onCornea);
#endif
#if LID_TYPE == 0 || LID_TYPE == 1
  // ---- lids: aperture in the socket frame (fixed to the head, not to the moving eyeball)
  #if LID_TYPE == 0
  float dUp = uLensD + uBlink * uLidTravel * 0.85, dLo = uLensD + uBlink * uLidTravel * 0.15;
  #else
  float dUp = uLensD + uBlink * uLidTravel * 0.12, dLo = uLensD + uBlink * uLidTravel * 0.88;
  #endif
  #if LID_TYPE == 0 && LID_ARC == 1
  // (look.lidArc) the corners stay put: the upper lid's edge descends as an arc from corner to corner and meets
  // the lower lid (which rises a little) along the whole fissure, so a shut eye shows its lid margins as one
  // curved seam; the two-circle lens below closes to a single point in the middle of the eye
  float hw = sqrt(max(uLensR * uLensR - uLensD * uLensD, 1e-10));
  float ax = min(abs(Sk.x), hw * 0.9999);
  float sq = sqrt(max(uLensR * uLensR - ax * ax, 1e-10));
  float yA = sq - uLensD, s0 = ax / sq;                       // the open upper edge (the lower is -yA), |slope|
  // (look.lidMeet: the lids meet at -lidMeet yA when shut, 0.7 by default; the upper lid travels 1 + lidMeet of yA)
  float kUp = 1.0 - (1.0 + uLidMeet) * uBlink, kLo = 1.0 - (1.0 - uLidMeet) * uBlink;
  float yUp = yA * kUp, yLo = -yA * kLo;
  float sdUp = (Sk.y - yUp) / sqrt(1.0 + kUp * kUp * s0 * s0);
  float sdLo = (yLo - Sk.y) / sqrt(1.0 + kLo * kLo * s0 * s0);
  float sdB = max(max(sdUp, sdLo), abs(Sk.x) - hw);
  #else
  float sdB = lensSD(Sk.xy, dUp, dLo);
  float sdUp = length(Sk.xy + vec2(0.0, dUp)) - uLensR;
  #endif
  lidCover = smoothstep(-0.00015, 0.00015, sdB);
  // (look.lidSeam > 0: the dark lid margin narrows as the lids close, to a seam of about that half-width when shut:
  // the open eye's 0.3-1.4 mm margin fade on both lids drew a shut eye's seam as a ~3 mm dark band)
  float mA = 0.0003, mB = 0.0014;
  if (uLidSeam > 0.0) { mA = mix(mA, 0.3 * uLidSeam, uBlink); mB = mix(mB, uLidSeam, uBlink); }
  lidMargin = 1.0 - smoothstep(mA, mB, sdB);
  float aoRim = smoothstep(0.0, -0.003, sdB);
  float shadowUp = smoothstep(-0.0075, -0.0004, sdUp);
  eyeAO = mix(1.0 - 0.7 * uRimShade, 1.0, aoRim) * (1.0 - 0.6 * uLidShade * shadowUp);
  eyeLightOcc = mix(1.0 - 0.45 * uRimShade, 1.0, aoRim) * (1.0 - 0.7 * uLidShade * shadowUp);
  #if LID_TYPE == 1
  // nictitating membrane: sweeps from the front corner across the eye
  float halfW = sqrt(max(uLensR * uLensR - uLensD * uLensD, 1e-10));
  float edgeX = mix(halfW * 1.1, -halfW * 1.1, uNict);
  nictCover = smoothstep(edgeX - 0.0004, edgeX + 0.0004, Sk.x * uFront) * step(0.001, uNict);
  // a milky, translucent sheet: the iris shows through, veiled and cooled
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.55, 0.6), nictCover * 0.6);
  #endif
  // short hairs / fine skin lying along the lid, a slightly darker fold near the brow, dark margin
  float hairs = 0.8 + 0.4 * evn3(vec3(Sk.x * 2600.0, Sk.y * 650.0, 3.7)) * evn3(vec3(Sk.x * 900.0, Sk.y * 260.0, 9.1));
  // (look.lidHair: a furred lid, strands lying along the lid from the nasal corner toward the temple and tufts
  // of them, at the contrast of the coat's own base streaks; faded out where they get smaller than a pixel)
  if (uLidHair > 0.0) {
    vec2 hq = vec2(Sk.x * uFront, Sk.y + 0.2 * Sk.x * uFront);
    float fdH = 1.0 - smoothstep(0.35, 0.9, length(fwidth(hq)) * 5200.0);
    float st1 = evn3(vec3(hq.x * 900.0, hq.y * 6000.0, 1.3)), st2 = evn3(vec3(hq.x * 450.0, hq.y * 2600.0, 7.9));
    float furH = mix(1.0, (0.62 + 0.76 * st1) * (0.84 + 0.32 * st2), fdH);
    hairs = mix(hairs, furH, uLidHair);
  }
  // (look.lidClump: the coat's tufts at a normal viewing distance, where the strands above fade out: tone variation
  // at the clump scale (~2-3 mm, drawn out along the lid hair), so a shut eye's lids read as fur, not a smooth disc)
  if (uLidClump > 0.0) {
    vec2 cq = vec2(Sk.x * uFront, Sk.y + 0.2 * Sk.x * uFront);
    float c1 = evn3(vec3(cq.x * 380.0, cq.y * 900.0, 5.3)), c2 = evn3(vec3(cq.x * 170.0, cq.y * 420.0, 2.1));
    float fdC = 1.0 - smoothstep(0.35, 0.9, length(fwidth(cq)) * 1300.0);
    hairs *= mix(1.0, (0.55 + 0.9 * c1) * (0.8 + 0.4 * c2), uLidClump * fdC);
  }
  float fold = 1.0 - 0.25 * smoothstep(0.0, 0.004, Sk.y);
  vec3 lidAlb = uLidColor * hairs * fold * mix(1.0, 0.06, lidMargin);
  diffuseColor.rgb = mix(diffuseColor.rgb, lidAlb, lidCover);
  gLidWrap = uLidFill * uLidFur * lidCover;
  eyeAO = mix(eyeAO, 1.0, lidCover);
  eyeLightOcc = mix(eyeLightOcc, 1.0, lidCover);
#endif
`;

// (look.lidFill) a furred closing lid takes the direct light like the coat round it: the coat's wrapped diffuse,
// (N.L + 0.4) / 1.4 (coatMaterial.js shadeLight), which lights fur well past the terminator where a Lambert lid went dark
const DIRECT = /* glsl */ `
#include <lights_physical_pars_fragment>
void RE_Direct_Eye(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
  RE_Direct_Physical(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
  if (gLidWrap > 0.0) {
    float ndl = dot(geometryNormal, directLight.direction);
    float extra = max(clamp((ndl + 0.4) / 1.4, 0.0, 1.0) - max(ndl, 0.0), 0.0);
    reflectedLight.directDiffuse += gLidWrap * extra * directLight.color * BRDF_Lambert(material.diffuseContribution);
  }
}
#undef RE_Direct
#define RE_Direct RE_Direct_Eye
`;

const MATERIAL = /* glsl */ `
  #include <lights_physical_fragment>
  // lids are skin, not cornea (look.lidSpec < 1: a furred lid, without the smooth ball's sky sheen)
  material.roughness = mix(material.roughness, 0.78, lidCover);
  float lidSpecK = mix(1.0, uLidSpec, lidCover);
  material.specularColor *= lidSpecK;
  material.specularColorBlended *= lidSpecK;
  material.specularF90 *= lidSpecK;
  #ifdef USE_CLEARCOAT
    material.clearcoat *= 1.0 - lidCover;
    material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.12, nictCover);
  #endif
`;

const NORMALS = /* glsl */ `
  #include <normal_fragment_maps>
#if LID_TYPE != 3
  {
    // (look.irisLight) the iris and the pupil are a flat disc behind the cornea, lit through it: shaded with the disc's
    // own normal (the eye's axis) instead of the cornea's sphere. Seen from below or from the side, the part of the
    // cornea in view faces away from a high light, and the iris behind it went black while the face round it was lit.
    // The clear coat (the cornea's reflection) keeps the sphere's normal.
    float irisK = uIrisLight * onCornea * (1.0 - lidCover);
    if (irisK > 0.0) normal = normalize(mix(normal, normalize(vIrisN), irisK));
    // (look.lidFlat) a closing lid lies in the face: shaded with the socket's axis (the face's normal round the eye)
    // rather than as a lit dome with a hard terminator across it
    if (uLidFlat > 0.0 && lidCover > 0.0) {
      vec3 sockZ = normalize((viewMatrix * vec4(uSocketInv[0][2], uSocketInv[1][2], uSocketInv[2][2], 0.0)).xyz);
      normal = normalize(mix(normal, sockZ, uLidFlat * lidCover));
    }
  }
#endif
`;

const MOD = /* glsl */ `
  #include <aomap_fragment>
  // (look.lidFur > 0: a furred closing lid is lit like the coat round it, by the scene's lights only: the coat
  // shader takes no environment map, so a lid that took the sky's light read paler than the fur outdoors and
  // darker indoors. look.glaze < 1: less of the base layer's broad sheen over the open eye; the clear coat's
  // sharp corneal reflection stays)
  float lidFurK = lidCover * uLidFur;
  // (look.ambient: the whole eye's indirect diffuse from the scene's ambient lights, as the coat is lit, not the
  // environment map's irradiance: a sky map poured blue light into an orange iris and greyed it)
  reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, irradiance * BRDF_Lambert(material.diffuseColor), max(lidFurK, uAmbient));
  // (look.fill: a fill light on the eye where the direct light does not reach, fading out where it does, as the
  // coat's camera-side fill lifts the fur round the eye: the sky in front of the eye (the environment map's
  // irradiance), or without an environment map the coat's own fill from the ambient lights. With the eye lit by the
  // weak ambient lights alone (look.ambient), an iris or a closed lid in shade went 4-10x darker than the fur, which
  // also takes light scattered through it; the sky map's full irradiance on the other hand bleached a sunlit iris)
  if (uEyeFill > 0.0) {
    // the coat's own fill (coatMaterial.js: the ambient and hemisphere lights' camera-side fill at its uFill 0.45)
    vec3 coatFill = ambientLightColor * 2.0;
    #if NUM_HEMI_LIGHTS > 0
    for (int i = 0; i < NUM_HEMI_LIGHTS; i++) coatFill += hemisphereLights[i].skyColor + hemisphereLights[i].groundColor;
    #endif
    coatFill *= 0.45 * clamp(dot(normal, geometryViewDir) * 0.6 + 0.4, 0.0, 1.0);
  #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
    // (look.lidFill: a furred closing lid takes the coat's fill like the fur round it, not the sky map's irradiance,
    // which lit a shut eye in shade 2-7x brighter than the fur: pale discs)
    vec3 fillIrr = mix(iblIrradiance, coatFill, uLidFill * lidFurK);
  #else
    vec3 fillIrr = coatFill;
  #endif
    vec3 dirC = vec3(0.0);
  #if NUM_DIR_LIGHTS > 0
    for (int i = 0; i < NUM_DIR_LIGHTS; i++) dirC += directionalLights[i].color;
  #endif
  #if NUM_SUN_LIGHTS > 0
    for (int i = 0; i < NUM_SUN_LIGHTS; i++) dirC += sunLights[i].color;
  #endif
    vec3 lam = BRDF_Lambert(material.diffuseColor);
    float litFrac = clamp(dot(reflectedLight.directDiffuse, vec3(1.0)) / max(dot(dirC * lam, vec3(1.0)), 1e-9), 0.0, 1.0);
    // (a furred lid with look.lidFill: the coat's full fill; the iris: look.fill's share of it)
    reflectedLight.indirectDiffuse += fillIrr * (mix(uEyeFill, 1.0, uLidFill * lidFurK) * (1.0 - litFrac)) * lam;
  }
  // (look.lidFill: the light a furred lid scatters toward the viewer from a sun behind it, as the coat's fur glows
  // against the light (coatMaterial.js back-scatter, (albedo + 0.04): a black coat's fur glows too), at about the
  // coat's level round the eye: backlit, the fur round a shut eye glowed while the lid went black)
  #if NUM_DIR_LIGHTS > 0
  if (uLidFill > 0.0 && lidFurK > 0.0) {
    for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
      float bl = pow(clamp(dot(-directionalLights[i].direction, geometryViewDir), 0.0, 1.0), 2.5);
      reflectedLight.directDiffuse += (uLidFill * lidFurK * 0.15 * bl) * directionalLights[i].color * BRDF_Lambert(material.diffuseColor + 0.04);
    }
  }
  #endif
  reflectedLight.indirectSpecular *= (1.0 - lidFurK) * mix(uGlaze, 1.0, lidCover);
  reflectedLight.directSpecular *= mix(uGlaze, 1.0, lidCover);
  reflectedLight.directDiffuse *= eyeLightOcc;
  reflectedLight.directSpecular *= eyeLightOcc;
  reflectedLight.indirectDiffuse *= eyeAO;
  reflectedLight.indirectSpecular *= eyeAO * uEnvSpec;
  #ifdef USE_CLEARCOAT
    clearcoatSpecularDirect *= eyeLightOcc;
    clearcoatSpecularIndirect *= eyeAO;
  #endif
`;

const smooth01 = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const col3 = (c, d) => new THREE.Color(...(c || d));

// Resolves a species look into complete parameters (defaults = cheetah).
export function resolveLook(look = {}) {
  const pupil = PUPIL[look.pupil] !== undefined ? look.pupil : 'round';
  const lids = LIDS[look.lids] !== undefined ? look.lids : 'mammal';
  return {
    pupil, lids,
    pupilSize: look.pupilSize || PUPIL_SIZE[pupil],
    iris: { ...DEFAULT_IRIS, ...(look.iris || {}) },
    sclera: { color: [0.2, 0.15, 0.11], visible: false, ...(look.sclera || {}) },
    lidColor: look.lidColor || [0.5, 0.31, 0.15],
    // shading of the eyeball by its lids (1 = the default: a deep-set eye; a flat face with prominent
    // eyes, the cat, shades less) and the darkening of the limbal ring (iris colour x limbus at its edge)
    shade: { rim: 1, lid: 1, ...(look.shade || {}) },
    limbus: look.limbus ?? 0.2,
    // specular of a closing lid (1 = the default smooth skin; a lid covered in short fur, the cat's, has
    // almost none: on a dark coat the smooth lid mirrored the sky and read as a glossy open eye)
    lidSpec: look.lidSpec ?? 1,
    // (0..1) a closing lid lit like fur: by the scene's lights only, no environment map (0 = the default: the
    // lid takes the environment like the eyeball it is painted on)
    lidFur: look.lidFur ?? 0,
    // (0..1) the base layer's broad specular sheen over the open eye (1 = the default); the clear coat (the
    // cornea's sharp reflection) is kept either way
    glaze: look.glaze ?? 1,
    // (0..1) the eye's indirect diffuse from the scene's ambient lights instead of the environment map (as the
    // coat shader is lit; 0 = the default)
    ambient: look.ambient ?? 0,
    // (0..1) a closing lid textured like fur (strands and tufts along the lid) instead of fine smooth skin
    lidHair: look.lidHair ?? 0,
    // (0..1) the iris and pupil shaded with the iris disc's normal (the eye's axis) instead of the cornea's sphere
    // (0 = the default: the sphere's, which darkens the iris seen from below or aside under a high light)
    irisLight: look.irisLight ?? 0,
    // (0..1) the coat shader's camera-side fill light on the eye (iris and lids) where the direct light does not
    // reach, as on the fur round it (0 = the default: none)
    fill: look.fill ?? 0,
    // (0..1) a closing lid shaded with the socket's axis, as the face round it, instead of as a dome (0 = the default)
    lidFlat: look.lidFlat ?? 0,
    // (m) the half-width the dark lid margin narrows to as the lids shut (0 = the default: the open eye's 0.3-1.4 mm
    // margin fade at every stage, a ~3 mm dark band along a shut eye's seam)
    lidSeam: look.lidSeam ?? 0,
    // (0..1) tone variation of a closing lid at the coat's clump scale (0 = the default: none)
    lidClump: look.lidClump ?? 0,
    // (0..1) the contrast of the iris's radial fibre bundles and dark crypts (1 = the default; a cat's even iris
    // with its crypts at full contrast read as the ticks of a clock face)
    irisTexture: look.irisTexture ?? 1,
    // (0..1, with fill and lidFur) a furred closing lid is lit like the coat round it: the coat's full ambient fill
    // instead of the environment map's irradiance, and the coat's wrapped diffuse (0 = the default)
    lidFill: look.lidFill ?? 0,
    // (mammal lids) true: the corners stay put and the lids meet along the whole fissure when they shut (a
    // curved seam); false (the default): the two-circle lens, which closes to a point
    lidArc: !!look.lidArc,
    // (with lidArc) where the shut lids meet, in units of the open aperture's half-height below its centre (0.7 = the
    // default; nearer 1 the upper lid does all the closing and the lower lid shows as a thinner band under the seam)
    lidMeet: look.lidMeet ?? 0.7,
    // (0..1) the cornea's clear coat strength (1 = the default; see the header: bear 0.2)
    cornea: look.cornea ?? 1,
    // (0..) scale of the eyeball's environment specular (1 = the default; see the header: bear 0.2). It multiplies
    // whatever glaze / lidFur leave of it, so the options compose
    envSpecular: look.envSpecular ?? 1,
  };
}

function applyLook(eyes, shared, look) {
  const L = resolveLook(look);
  shared.uIrisIn.value.setRGB(...L.iris.inner);
  shared.uIrisMid.value.setRGB(...L.iris.mid);
  shared.uIrisHi.value.setRGB(...L.iris.hi);
  shared.uIrisOut.value.setRGB(...L.iris.outer);
  const sc = L.sclera.visible ? L.sclera.color : L.sclera.color.map((c) => c * 0.6);
  shared.uSclera.value.setRGB(...sc);
  shared.uLidColor.value.setRGB(...L.lidColor);
  shared.uRimShade.value = L.shade.rim;
  shared.uLidShade.value = L.shade.lid;
  shared.uLimbus.value = L.limbus;
  shared.uLidSpec.value = L.lidSpec;
  shared.uLidFur.value = L.lidFur;
  shared.uGlaze.value = L.glaze;
  shared.uAmbient.value = L.ambient;
  shared.uLidHair.value = L.lidHair;
  shared.uIrisLight.value = L.irisLight;
  shared.uEyeFill.value = L.fill;
  shared.uLidFlat.value = L.lidFlat;
  shared.uLidSeam.value = L.lidSeam;
  shared.uLidClump.value = L.lidClump;
  shared.uLidFill.value = L.lidFill;
  shared.uIrisTex.value = L.irisTexture;
  shared.uLidMeet.value = L.lidMeet;
  shared.uEnvSpec.value = L.envSpecular;
  for (const e of eyes) {
    const m = e.material;
    m.defines = { PUPIL_TYPE: PUPIL[L.pupil], LID_TYPE: LIDS[L.lids], LID_ARC: L.lidArc ? 1 : 0 };
    m.roughness = L.lids === 'simple' ? 0.25 : 0.6;
    m.clearcoatRoughness = L.lids === 'none' || L.lids === 'simple' ? 0.02 : 0.03;
    m.clearcoat = L.cornea;
    m.needsUpdate = true;
  }
  return L;
}

export function createEyes(eyeData) {
  eyeData = eyeData || [];
  const shared = {
    uPupil: { value: 0.36 },
    uBlink: { value: 0 },
    uNict: { value: 0 },
    uLower: { value: 0 },
    uLidColor: { value: new THREE.Color() },
    uIrisIn: { value: new THREE.Color() },
    uIrisMid: { value: new THREE.Color() },
    uIrisHi: { value: new THREE.Color() },
    uIrisOut: { value: new THREE.Color() },
    uSclera: { value: new THREE.Color() },
    uRimShade: { value: 1 },
    uLidShade: { value: 1 },
    uLimbus: { value: 0.2 },
    uLidSpec: { value: 1 },
    uLidFur: { value: 0 },
    uGlaze: { value: 1 },
    uAmbient: { value: 0 },
    uLidHair: { value: 0 },
    uIrisLight: { value: 0 },
    uEyeFill: { value: 0 },
    uLidFlat: { value: 0 },
    uLidSeam: { value: 0 },
    uLidClump: { value: 0 },
    uLidFill: { value: 0 },
    uIrisTex: { value: 1 },
    uLidMeet: { value: 0.7 },
    uEnvSpec: { value: 1 },
  };
  const geos = new Map();
  // 'simple' eyes (spiders: up to eight still domes on one bone) are merged into one mesh built in
  // bind space, so they cost a single draw call
  const L0 = resolveLook(eyeData[0]?.look);
  if (L0.lids === 'simple' && eyeData.length > 1 && eyeData.every((ed) => (ed.bone || 'head') === (eyeData[0].bone || 'head'))) {
    const pos = [], nrm = [], idx = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    for (const ed of eyeData) {
      const E = ed.spec, g = new THREE.SphereGeometry(E.r, 28, 18);
      g.rotateX(Math.PI / 2);
      const x = new THREE.Vector3(...ed.x), y = new THREE.Vector3(...ed.y), z = new THREE.Vector3(...ed.z);
      q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      g.applyMatrix4(m.compose(new THREE.Vector3(...ed.c), q, sc.setScalar(ed.scale || 1)));
      const o = pos.length / 3;
      for (const v of g.attributes.position.array) pos.push(v);
      for (const v of g.attributes.normal.array) nrm.push(v);
      for (const k of g.index.array) idx.push(k + o);
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setIndex(idx);
    geos.set('merged', geo);
    eyeData = [{ ...eyeData[0], c: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], scale: 1, side: 1, spec: { ...eyeData[0].spec, tilt: 0 }, merged: geo }];
  }
  const eyes = eyeData.map((ed, i) => {
    const E = ed.spec;
    const own = {
      uSocketInv: { value: new THREE.Matrix4() },
      uIrisZ: { value: E.irisZ ?? E.r * 0.6 },
      uIrisR: { value: E.irisR ?? E.r * 0.8 },
      uLensR: { value: E.R ?? E.r * 1.15 },
      uLensD: { value: E.d ?? E.r * 0.7 },
      uLensOff: { value: E.off || 0 },
      uLidTravel: { value: 2 * ((E.R ?? E.r * 1.15) - (E.d ?? E.r * 0.7)) },
      uFront: { value: 1 },
    };
    let geo = ed.merged || geos.get(E.r);
    if (!geo) {
      geo = new THREE.SphereGeometry(E.r, 64, 40);
      geo.rotateX(Math.PI / 2); // pole -> +Z (forward)
      geos.set(E.r, geo);
    }
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 0.2, envMapIntensity: 0.28 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, shared, own);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vEyeObj; varying vec3 vCamObj; varying vec3 vEyeWorld; varying vec3 vIrisN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vEyeObj = position;\n  vEyeWorld = (modelMatrix * vec4(position, 1.0)).xyz;\n  vCamObj = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;\n  vIrisN = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + PARS)
        .replace('#include <map_fragment>', MAP)
        .replace('#include <normal_fragment_maps>', NORMALS)
        .replace('#include <lights_physical_pars_fragment>', DIRECT)
        .replace('#include <lights_physical_fragment>', MATERIAL)
        .replace('#include <aomap_fragment>', MOD);
    };
    mat.customProgramCacheKey = () => 'pa-eye-' + (mat.defines ? mat.defines.PUPIL_TYPE + '-' + mat.defines.LID_TYPE + (mat.defines.LID_ARC ? '-arc' : '') : '');
    const e = new THREE.Mesh(geo, mat);
    e.name = 'eye' + i;
    e.matrixAutoUpdate = false;
    e.frustumCulled = false;
    e.receiveShadow = true;
    // bind-space frames: the socket (aperture, tilted) and the eyeball at rest (upright pupil)
    const x = new THREE.Vector3(...ed.x), y = new THREE.Vector3(...ed.y), z = new THREE.Vector3(...ed.z);
    const socketQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    const ph = (E.tilt || 0) * ed.side;
    const x0 = x.clone().multiplyScalar(Math.cos(ph)).addScaledVector(y, -Math.sin(ph));
    const y0 = x.clone().multiplyScalar(Math.sin(ph)).addScaledVector(y, Math.cos(ph));
    const ballQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x0, y0, z));
    // the front (nasal) corner: +x or -x of the socket frame, whichever points forward
    own.uFront.value = x.z >= 0 ? 1 : -1;
    e.userData = { side: ed.side, bone: ed.bone || 'head', c: new THREE.Vector3(...ed.c), socketQ, ballQ, own, scale: ed.scale || 1, r: E.r };
    return e;
  });
  const look = applyLook(eyes, shared, eyeData[0]?.look);
  return { eyes, uniforms: shared, look, geometries: [...geos.values()] };
}

// Places the eyes on their bone every frame and runs saccades, blinks, lids and pupils.
export class EyeRig {
  constructor(eyes, uniforms, skeleton, look) {
    this.eyes = eyes;
    this.u = uniforms;
    this.sk = skeleton;
    this.setLook(look);
    this.gaze = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, next: 0.6, lookYaw: 0, lookPitch: 0 };
    this.blinkWait = 1.5 + Math.random() * 3;
    this.blinkAge = -1;
    this.pendingDouble = false;
    this.pupil = 0.4;
    this.lidState = 0;
    // test / cinematic overrides (null = automatic): blink 0..1, dilation 0..1, pupil size, gaze [yaw, pitch], eyelid 0..1
    this.override = { blink: null, dilation: null, pupil: null, gaze: null, eyelid: null };
    this._light = null; this._lightAge = 1e9;
    this._qb = new THREE.Quaternion(); this._pb = new THREE.Vector3(); this._sb = new THREE.Vector3();
    this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion(); this._qe = new THREE.Quaternion();
    this._p = new THREE.Vector3(); this._t = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this._Y = new THREE.Vector3(0, 1, 0); this._X = new THREE.Vector3(1, 0, 0);
    this._bindQinv = new Map(); this._bindP = new Map();
  }

  setLook(look) {
    this.look = look;
    this.canBlink = (look.lids === 'mammal' || look.lids === 'bird') && look.blink !== false;
  }

  _boneRel(name) {
    const i = this.sk.index[name] ?? this.sk.index.head ?? 0;
    if (!this._bindQinv.has(i)) {
      const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
      this.sk.bind[i].decompose(p, q, s);
      this._bindQinv.set(i, q.invert());
      this._bindP.set(i, p);
    }
    this.sk.bones[i].matrixWorld.decompose(this._pb, this._qb, this._sb);
    this._qb.multiply(this._bindQinv.get(i));                       // rigid rotation: world * bind^-1
    this._t.copy(this._bindP.get(i)).applyQuaternion(this._qb).negate().add(this._pb);
    return { q: this._qb, t: this._t };
  }

  // the scene's main directional light (the shadow caster, else the brightest), refreshed now and then
  _mainLight(root, dt) {
    this._lightAge += dt;
    if (root && (this._lightAge > 1 || root !== this._root || (this._light && !this._light.parent))) {
      this._root = root;
      this._lightAge = 0;
      let best = null, score = -1;
      root.traverse((o) => {
        if (!o.isDirectionalLight || !o.visible) return;
        const s = o.intensity * (o.castShadow ? 10 : 1);
        if (s > score) { score = s; best = o; }
      });
      this._light = best;
    }
    return this._light;
  }

  update(dt, { root = null, state = {}, look = null } = {}) {
    const dead = state.action === 'death' || state.dead === true;
    const lid = this.override.eyelid ?? Math.max(state.eyelid || 0, dead ? 0.5 : 0);
    const g = this.gaze;
    // fixations and quick saccades (smaller and rarer at speed, when the gaze locks forward)
    const run = Math.min(1, (state.speed || 0) / 10);
    g.next -= dt;
    if (g.next <= 0 && !dead) {
      g.next = (0.5 + Math.random() * 2.3) * (1 + run * 2);
      g.tYaw = (Math.random() - 0.5) * 0.18 * (1 - 0.7 * run);
      g.tPitch = (Math.random() - 0.5) * 0.08 * (1 - 0.7 * run);
    }
    // the eyes lead the head toward a look target (then recentre as the head catches up)
    let lyaw = 0, lpitch = 0;
    const target = state.lookTarget || look;
    if (target && !dead && this.eyes.length) {
      const e = this.eyes[0], rel = this._boneRel(e.userData.bone);
      let ay = 0, ap = 0;
      for (const ey of this.eyes) {
        const d = ey.userData;
        this._p.copy(d.c).applyQuaternion(rel.q).add(rel.t);
        this._q.copy(rel.q).multiply(d.ballQ).invert();
        const v = this._p.subVectors(target, this._p).applyQuaternion(this._q);
        ay += Math.atan2(v.x, v.z); ap += Math.atan2(v.y, Math.hypot(v.x, v.z));
      }
      const n = this.eyes.length;
      lyaw = THREE.MathUtils.clamp(ay / n, -0.35, 0.35);
      lpitch = THREE.MathUtils.clamp(ap / n, -0.25, 0.25);
    }
    const kl = 1 - Math.exp(-dt / 0.03);
    g.lookYaw += (lyaw - g.lookYaw) * kl;
    g.lookPitch += (lpitch - g.lookPitch) * kl;
    const k = 1 - Math.exp(-dt / 0.022);
    g.yaw += (g.tYaw - g.yaw) * k;
    g.pitch += (g.tPitch - g.pitch) * k;
    // blinks: ~70 ms close, 35 ms hold, 130 ms open; sometimes a double blink. Birds blink with
    // the nictitating membrane (a bit slower sweep).
    let b = 0;
    if (this.canBlink && !dead && lid < 0.95) {
      this.blinkWait -= dt;
      if (this.blinkAge < 0 && this.blinkWait <= 0) {
        this.blinkAge = 0;
        this.pendingDouble = !this.pendingDouble && Math.random() < 0.15;
        this.blinkWait = this.pendingDouble ? 0.1 : 2.5 + Math.random() * 5.5;
      }
      if (this.blinkAge >= 0) {
        this.blinkAge += dt;
        const bird = this.look.lids === 'bird';
        const t = this.blinkAge, c = bird ? 0.09 : 0.07, h = bird ? 0.05 : 0.035, o = bird ? 0.12 : 0.13;
        if (t < c) b = smooth01(t / c);
        else if (t < c + h) b = 1;
        else if (t < c + h + o) b = 1 - smooth01((t - c - h) / o);
        else { b = 0; this.blinkAge = -1; }
      }
    }
    if (state.nictitate > 0 && this.look.lids === 'bird') b = Math.max(b, state.nictitate);
    if (this.override.blink !== null) b = this.override.blink;
    this.lidState += (lid - this.lidState) * (1 - Math.exp(-dt / 0.15));
    if (dt === 0) this.lidState = lid;
    if (this.look.lids === 'bird') { this.u.uNict.value = b; this.u.uBlink.value = this.lidState; }
    else if (this.look.lids === 'mammal') { this.u.uNict.value = 0; this.u.uBlink.value = Math.max(b, this.lidState); }
    else { this.u.uNict.value = 0; this.u.uBlink.value = 0; }
    // pupil: small in bright sun, wide when the sun is low or the animal is aroused
    let dil = 0.35;
    const L = this._mainLight(root, dt);
    if (L) {
      L.updateMatrixWorld();
      this._p.setFromMatrixPosition(L.matrixWorld);
      if (L.target) { L.target.updateMatrixWorld(); this._p.sub(this._t.setFromMatrixPosition(L.target.matrixWorld)); }
      const elev = this._p.normalize().y;
      this.lightElevation = elev;
      dil = 1 - Math.min(1, Math.max(0, (elev - 0.05) / 0.35));
      dil = dil * 0.85 + 0.15 * (1 - Math.min(1, L.intensity / 3));
    }
    if (state.action === 'attack' || state.speed > 8) dil = Math.min(1, dil + 0.3);
    if (dead) dil = 0.9;
    if (this.override.dilation !== null) dil = this.override.dilation;
    const kp = dt > 0 ? 1 - Math.exp(-dt / 0.4) : 1;
    this.pupil += (dil - this.pupil) * kp;
    const ps = this.look.pupilSize;
    this.u.uPupil.value = this.override.pupil ?? THREE.MathUtils.lerp(ps[0], ps[1], this.pupil);
    // place each eye: socket frame (aperture) and eyeball (rest * gaze)
    const gy = this.override.gaze ? this.override.gaze[0] : g.yaw + g.lookYaw;
    let gp = this.override.gaze ? this.override.gaze[1] : g.pitch + g.lookPitch;
    // ocular rotation: the eyeball rolls back and down (the white shark protects its eye on the bite)
    const roll = state.eyeRoll || 0;
    if (roll > 0 && !this.override.gaze) gp -= roll * 1.25;
    for (const e of this.eyes) {
      const d = e.userData;
      const rel = this._boneRel(d.bone);
      this._p.copy(d.c).applyQuaternion(rel.q).add(rel.t);
      this._s.setScalar(d.scale);
      this._q.copy(rel.q).multiply(d.socketQ);
      d.own.uSocketInv.value.compose(this._p, this._q, this._s).invert();
      const still = this.look.lids === 'simple';
      this._qe.copy(rel.q).multiply(d.ballQ);
      if (!still) this._qe.multiply(this._q2.setFromAxisAngle(this._Y, gy)).multiply(this._q2.setFromAxisAngle(this._X, -gp));
      e.matrix.compose(this._p, this._qe, this._s);
      e.matrixWorld.copy(e.matrix);
      if (e.parent) e.matrixWorld.premultiply(e.parent.matrixWorld);
    }
  }
}

export { applyLook as setEyeLook };
