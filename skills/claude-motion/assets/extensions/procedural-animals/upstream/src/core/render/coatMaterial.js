// Coverings: fur, bare skin, leather, keratin, scales, wet skin, chitin, feathers and fin membranes
// (material 11: translucent, rays; drawn as a separate transparent pass, see membranes.js), all lit by the
// scene's own three.js lights (directional + shadows, point + shadows, spot + shadows, hemisphere,
// ambient, light probes), fog and tone mapping.
//
// Three passes share one shading model:
//  - base: the opaque, dual-quaternion skinned surface. Every material id (tint.w) gets its own
//    surface detail here (pebbled leather, pores, growth striations, overlapping scales, granular
//    wet skin, chitin segments, feather shingles with rachis and barbs). Without shells (crowd tier,
//    coverings hidden) fur still reads as fur on the base: hair-flow streaks and anisotropic sheen.
//  - shells: ONE instanced draw; gl_InstanceID = shell index. Strands are hashed from bind-space
//    position (so they stick to the skin under any pose) and grouped into clumps: going up the
//    shells, strands converge toward their clump centre, so the top of the coat breaks into tufts
//    with dark gaps between them. Clumps vary in length, shade and lean, and a clump either belongs
//    to a spot or not, which rags the spot edges. Shells draw wherever furLen > 0 on fur (0), bare
//    skin (4: sparse bristles) and feathers (9: a soft down fringe).
//  - fins: one camera-facing strand card per skin vertex, shown only near the silhouette, so the
//    outline is made of individual hairs instead of a smooth edge.
// Depth: the shells write depth (drawn inner layer to outer), so a coat hides what lies behind it however
// the draws are ordered: the far legs behind a belly fringe, another part's fins (drawn after the shells,
// they used to draw the outlines of every part behind the coat across it). Between the strands each
// layer carries an undercoat (render hint undercoat: the hair the strand grid does not resolve), an
// optical depth taken along the line of sight and spread over the shell count, so the coat is as
// opaque at every tier and where one looks along it, shaded like the deep coat it stands in for.
//
// Hair lighting per light: wrapped diffuse + two-lobe Kajiya-Kay (R / TRT) + back-scatter through
// thin fur, depth-in-fur and between-tuft occlusion. Surfaces use wrapped / subsurface diffuse,
// normalised Blinn-Phong, an optional clear coat and anisotropic lobes. Units follow
// MeshStandardMaterial: a light of intensity I lights a covering of albedo a like a standard
// material of colour a (radiance = a * E / PI), so animals sit correctly next to your scenery.
//
// Every animal owns its uniforms (three.js shares the compiled programs). Species render hints,
// `species.render = { markColor, strandDensity, clumpDensity, shellScale, finWidth }`:
//   markColor      linear rgb of crisp marks (tear lines, eye rims, lips)   default cheetah black
//   strandDensity  strands per metre (planar hash grid)                     default 620
//   clumpDensity   multiplier on tuft density                               default 1
//   shellScale     multiplier on hair length for shells and fins            default 1
//   finWidth       silhouette card width as a fraction of hair length       default 0.5
//   fins           false: no silhouette fins (very long coats: bear)       default true
//   finMask        true: on fur (material 0) the coat's surf.y (unused by fur) thins the silhouette fins,
//                  0 = full fins .. 1 = none (the cat's head: the head's silhouette ring of fins stood
//                  in front of the neck fur as a hood round the face)              default false
//   finMinLen      hair length (m) below which no silhouette fins are drawn  default 0.0058 (a species with a
//                  short face coat and a long mane raises it: fins on the mane only)
//   strandBlend    0: the shells' strands are hashed on one axis plane picked by the rest normal's largest
//                  component (default); > 0: near a switch of that axis the second plane's strands are
//                  cross-faded in over this band of normal components (e.g. 0.12), so no seam line shows where
//                  the plane switches (a short-coated broad face tilted ~45 deg: a lion's forehead drew a
//                  rectangle); costs a second strand evaluation per shell fragment
//   scaleEdge      contrast of the scale rims, overlap shadows and relief (material 6) default 1 (fish 0.15)
//   featherEdge    contrast of the contour-feather shingles (material 9)     default 1 (pale birds ~0.5)
//   denticles      0..1: material 6 is shark skin instead of overlapping scales: dermal denticles ridged
//                  along the comb (surf.y = denticle size), a matte fine grain streaked along the body, a
//                  soft broad anisotropic sheen across the ridges, no clear coat                default 0
//   raiseLen       [from, full] hair length (m) over which piloerection (state.furRaise) lifts the hair
//                  default [0.025, 0.05] (wolf hackles); short-coated animals lower it (cat [0.006, 0.014])
//   leatherTint    0..1: nose leather (material 1) takes its colour from the tint (pink or brick noses and
//                  pads as leather, cat); default 0: the dark leather of every other species
//   leatherRelief  0..1: depth of the leather's pebbling (crease darkening, cobble shade, bump); default 1.
//                  A small nose in daylight (the cat's) read speckled at full relief
//   skinScatter    bare skin (material 4): [r, g, b, wrap], the tint of the light wrapped past the terminator
//                  (subsurface) and how far it wraps                       default [0.85, 0.35, 0.25, 0.55]
//   skinTrans      bare skin: [base, perVertex], light through the skin lit from behind = base + perVertex x
//                  surf.y (per vertex, unused otherwise by skin: thin ears and tails glow, a thick body
//                  does not)                                               default [0.5, 0]
//   noseRoughness  roughness of the nose leather (material 1)                default 0.42
//   noseMarks      1: marks (coat mark < 0) are drawn on the nose leather too, as openings (the nostrils:
//                  mark colour, no sheen from inside); default 0 (the leather hides marks)
//   noseTint       1: the nose leather takes its albedo from the coat's per-vertex colour (pale rims, a
//                  septum painted by the species) instead of the fixed dark grey; default 0. The same
//                  blend as leatherTint 1 (both read the per-vertex tint): the larger of the two applies
//   clumpLen       [from, full] hair length (m) over which the tufts form (clumping strength 0 -> 1)
//                  default [0.0055, 0.016]; a long coat with a sleek face raises it, so 1-3 cm facial and
//                  ear hair lies smooth instead of curling into round tufts (bear [0.012, 0.045])
//   shellShadowRoot 0..1: where the shells look up cast shadows, from each layer's own position (0) to the hair's
//                  root (1). At 0 every layer of a long coat crosses a cast shadow's edge at its own place, and seen
//                  at a grazing angle the stack shows as torn dark sheets (bear: the neck's 5-10 cm hair in the
//                  head's shadow behind the jaw); at 1 a strand is lit or shadowed as one.     default 0
//   undercoat      optical depth per unit of coat height of the hair between the strands, at the roots (fading
//                  to none at 0.9 of the hair's height): 0 = strands only (what lay under a long coat showed between
//                  them: a leg under a fringe, a folded wing in down)                         default 3
//   shellDepthBias [k, from]: a long coat's shells are depth-tested k x (hair length - from) closer to the camera
//                  than they are (a strand's every layer, constant along the strand). The shells slide along the comb
//                  as they rise (up to 0.85 x the hair length), so where the skin creases (a sheep's throat when the
//                  head drops to graze or turns aside) the layers of one side dive under the skin of the other and the
//                  crease shows as a jagged bald line; the bias keeps them in front of a fold that shallow. Shorter hair
//                  than `from` is untouched (face, lids).                                     default [0, 0] (off)
// Nose leather (material 1) takes its roughness from -surf.y when surf.y < 0 (a matte nose or paw pad:
// bear nose -0.62, paw pads -0.75); otherwise from the render hint noseRoughness (satin 0.42 by default).
//   matBorders     true: a material border runs through the middle of the edges between the two
//                  materials (interpolated one-hot weights) instead of rounding the interpolated id,
//                  which shades a strip of nose / dark skin / mouth (ids 1-3) between fur (0) and bare
//                  skin (4) or keratin (5): black-and-red rims round pink noses, udders and hooves.
//                  default false (the rounding); one more varying (vec4)
//   flatMaterial   true: each triangle takes one material (its provoking vertex's) instead of rounding
//                  the interpolated material id; default false. The id is a smooth varying, so a
//                  triangle from fur (0) to bare skin (4), keratin (5) or wet skin (7) passes through
//                  thin bands of the ids in between, whose albedos are fixed (nose 1 dark, lids 2 black,
//                  mouth 3 red): a dark / red rim along every bare-skin border (a cow's pink muzzle,
//                  udder, lid rims, coronets). Species whose bare skin meets fur opt in.
//                  matBorders (goat) answers the same bands by splitting each triangle through its edge
//                  middles instead; a species picks one (with both set, flatMaterial applies)
import * as THREE from 'three';
import { DQS_GLSL, DQS_ATTR_GLSL } from './dqs.js';

export const RENDER_DEFAULTS = {
  markColor: [0.016, 0.0105, 0.0075],
  strandDensity: 620,
  clumpDensity: 1,
  shellScale: 1,
  finWidth: 0.5,
  finMinLen: 0.0058,
  strandBlend: 0,
  scaleEdge: 1,
  featherEdge: 1,
  denticles: 0,
  raiseLen: [0.025, 0.05],
  leatherTint: 0,
  leatherRelief: 1,
  skinScatter: [0.85, 0.35, 0.25, 0.55],
  skinTrans: [0.5, 0],
  noseRoughness: 0.42,
  noseMarks: 0,
  noseTint: 0,
  clumpLen: [0.0055, 0.016],
  shellShadowRoot: 0,
  shellDepthBias: [0, 0],
  undercoat: 3,
  flatMaterial: false,
};

export const MAX_PAINTED_EYES = 8;

const common = /* glsl */ `
uniform float uShells;
uniform float uShellsOn;
uniform float uFinFade; // fins: opacity of the whole fin pass (tier transitions, animalObject setQuality)
uniform float uUnder; // shells: the undercoat's optical depth per unit coat height at the roots (render hint undercoat)
uniform float uFurScale;
uniform vec3 uFurForce;
uniform float uFurRaise;
uniform vec2 uRaiseLen; // hair lengths over which piloerection sets in (render hint raiseLen)
uniform vec2 uClumpLen; // hair lengths over which the tufts form (render hint clumpLen)
uniform float uTime;
uniform float uStrandDensity;
uniform float uClumpDensity;
uniform float uFinWidth;
uniform float uFinMask;
uniform float uFinMinLen;
uniform float uStrandBlend;
uniform float uWind;
uniform float uDebug;
uniform float uForceMat;
uniform float uFlatMat; // render hint flatMaterial: the material id from the provoking vertex (vMatF)
uniform vec3 uMarkColor;
uniform float uNoseRough; // render hint noseRoughness
uniform float uNoseMarks; // render hint noseMarks
uniform float uNoseTint; // render hint noseTint
uniform float uFill;
uniform float uScaleEdge;
uniform float uFeatherEdge;
uniform float uLeatherTint;
uniform float uLeatherRelief;
uniform vec4 uSkinScatter; // bare skin: subsurface tint (rgb) and wrap (render hint skinScatter)
uniform vec2 uSkinTrans; // bare skin: transmission = x + y * surf.y (render hint skinTrans)
uniform float uDenticle;
uniform float uPaintEyes;
// environment light (setEnvironmentLight): the scene environment's diffuse irradiance as 9 world-space
// SH coefficients (three.js SphericalHarmonics3 / LightProbe convention), scaled; uEnvOn 0 = none (default)
uniform vec3 uEnvSH[9];
uniform float uEnvOn;
uniform vec3 uBaseTone; // fur albedo gain of the base when it is seen without shells (crowd tier)
uniform float uShellShadowRoot; // shells: cast shadows looked up toward the hair's root (render hint shellShadowRoot)
uniform vec2 uShellBias; // shells: depth pulled toward the camera by x * (hair length - y) (render hint shellDepthBias)
uniform vec2 uSeam; // cross-fade seam skirt (build/seams.js): x = sink depth (m), y = fade where the base stops
uniform vec4 uEyes[${MAX_PAINTED_EYES}];
uniform vec3 uEyeTint[${MAX_PAINTED_EYES}];
varying vec3 vRest;
varying vec3 vRestN;
varying vec3 vRestC;
varying vec3 vWorldPos;
varying vec3 vN;
varying vec3 vT;
varying vec4 vTint;
flat varying float vMatF;
varying vec4 vCoat;
varying vec4 vPat;
varying vec4 vSurf;
varying vec4 vFin; // x across 0..1 (fins), y up 0..1 (fins), z silhouette visibility, w = height in coat
#ifdef PA_DEBUG
varying vec3 vDbg;
#endif
// which material ids grow hair in the shells / fins: fur, bare skin (bristles), chitin (setae), feathers (down)
bool hairy(float m) { return m < 0.5 || abs(m - 4.0) < 0.5 || abs(m - 8.0) < 0.5 || abs(m - 9.0) < 0.5; }
float matId(float a) { return uForceMat >= 0.0 ? uForceMat : floor(a + 0.5); }
#ifdef PA_MAT_BORDERS
// (render hint matBorders) the material of a fragment is the one whose interpolated one-hot weight is the
// largest (ids 0..3 in vMatW; the rest, ids >= 4, recovered from the interpolated id), so the border
// between two materials runs through the middle of the edges between them. Rounding the interpolated
// id shaded a strip of every id in between: nose, dark skin and mouth (1..3) round a pink nose, an
// udder or a hoof (fur 0 next to skin 4 / keratin 5).
varying vec4 vMatW;
vec4 matOneHot(float a) { return vec4(equal(vec4(floor(a + 0.5)), vec4(0.0, 1.0, 2.0, 3.0))); }
float matIdFrag(float a) {
  if (uForceMat >= 0.0) return uForceMat;
  vec4 w = vMatW;
  float r = 1.0 - (w.x + w.y + w.z + w.w), best = w.x, id = 0.0;
  if (w.y > best) { best = w.y; id = 1.0; }
  if (w.z > best) { best = w.z; id = 2.0; }
  if (w.w > best) { best = w.w; id = 3.0; }
  if (r > best) id = floor((a - (w.y + 2.0 * w.z + 3.0 * w.w)) / max(r, 1e-4) + 0.5);
  return id;
}
#else
float matIdFrag(float a) { return matId(a); }
#endif
`;

// how a hair rises from the skin: lifted along the normal, laid down along the comb, bent by force
const hairProfile = /* glsl */ `
const float LIFT = 0.5;
const float SLIDE = 0.85;
float hash31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
vec3 furForce(vec3 rest, vec3 sN) {
  float ph = hash31(floor(rest * 60.0)) * 6.2831;
  vec3 flutter = vec3(sin(uTime * 7.0 + ph), 0.0, cos(uTime * 5.3 + ph * 1.3)) * uWind * 0.25;
  vec3 force = uFurForce + flutter;
  if (any(isnan(force)) || any(isinf(force))) force = vec3(0.0, -0.2, 0.0);
  // remove the part of the force that would push the hair into the skin
  force -= sN * min(0.0, dot(force, sN)) * 0.9;
  return force;
}
// piloerection (hackles): long hair stands up off the skin
float hairRaise(float L) { return uFurRaise * smoothstep(uRaiseLen.x, uRaiseLen.y, L / max(uFurScale, 1e-3)); }
vec3 hairOffset(vec3 sN, vec3 sC, vec3 force, float L, float h) {
  float r = hairRaise(L);
  return sN * (L * (LIFT + 0.45 * r) * h) + sC * (L * SLIDE * (1.0 - 0.55 * r) * (h * h * 0.6 + h * 0.4)) + force * (L * h * h * (1.0 - 0.6 * r));
}
vec3 hairDir(vec3 sN, vec3 sC, vec3 force, float L, float h) {
  float r = hairRaise(L);
  return normalize(sN * (LIFT + 0.45 * r) + sC * SLIDE * (1.0 - 0.55 * r) * (0.4 + 1.2 * h) + force * (2.0 * h * (1.0 - 0.6 * r)));
}
void debugColour(vec4 si, vec4 sw) {
#ifdef PA_DEBUG
  vec3 bc0 = fract(vec3(0.13, 0.37, 0.71) * si.x * 7.31 + vec3(0.1, 0.5, 0.3));
  vec3 bc1 = fract(vec3(0.13, 0.37, 0.71) * si.y * 7.31 + vec3(0.1, 0.5, 0.3));
  vec3 bc2 = fract(vec3(0.13, 0.37, 0.71) * si.z * 7.31 + vec3(0.1, 0.5, 0.3));
  vec3 bc3 = fract(vec3(0.13, 0.37, 0.71) * si.w * 7.31 + vec3(0.1, 0.5, 0.3));
  vDbg = bc0 * sw.x + bc1 * sw.y + bc2 * sw.z + bc3 * sw.w;
#endif
}
`;

const vertex = /* glsl */ `
#include <common>
#include <shadowmap_pars_vertex>
#include <fog_pars_vertex>
${common}
${DQS_GLSL}
${DQS_ATTR_GLSL}
attribute vec3 aComb;
attribute vec4 aTint;
attribute vec4 aCoat;
attribute vec4 aPat;
attribute vec4 aSurf;
${hairProfile}

void main() {
  vec3 sP = position, sN = normal, sC = aComb;
  dqsSkin(sP, sN, sC);
  sP = (modelMatrix * vec4(sP, 1.0)).xyz;
  sN = normalize(mat3(modelMatrix) * sN);
  sC = mat3(modelMatrix) * sC;
  sC = normalize(sC - sN * dot(sC, sN) + 1e-6);
#ifndef FUR_SHELL
  // seams (build/seams.js): two overlapping surfaces hand over at fade 0.5 but do not coincide there.
  // Past the midline the base does not stop at a step one could look through: it sinks along its
  // normal under the surface taking over (which wins the depth test), down to fade uSeam.y.
  // (quadratic: tangent to the skin at the midline, so coarse triangles across the band do not fold)
  float seamT = clamp((0.5 - aCoat.w) / max(0.5 - uSeam.y, 1e-3), 0.0, 1.0);
  sP -= sN * (uSeam.x * seamT * seamT);
#endif

  float h = 0.0;
  vec3 wp = sP;
  vec3 strand = sC;
#ifdef FUR_SHELL
  float L = aCoat.z * uFurScale;
  vec3 force = furForce(position, sN);
  h = (float(gl_InstanceID) + 1.0) / uShells;
  // (a fractional shell count during a tier transition: the topmost partial layer lies at the tips and
  // fades in by the fraction)
  float layerFade = clamp(1.0 - (h - 1.0) * uShells, 0.0, 1.0);
  h = min(h, 1.0);
  wp = sP + hairOffset(sN, sC, force, L, h);
  strand = hairDir(sN, sC, force, L, h);
#endif
  debugColour(skinIndex, skinWeight);
  vRest = position;
  vRestN = normal;
  vRestC = aComb;
  vWorldPos = wp;
  vN = sN;
  vT = strand;
  vTint = aTint;
#ifdef PA_MAT_BORDERS
  vMatW = matOneHot(aTint.a);
#endif
  vMatF = aTint.a;
  vCoat = aCoat;
  vPat = aPat;
  vSurf = aSurf;
  vFin = vec4(0.0, 0.0, 0.0, h);
#ifdef FUR_SHELL
  vFin.z = layerFade;
#endif

  vec4 worldPosition = vec4(wp, 1.0);
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
#ifdef FUR_SHELL
  // (render hint shellDepthBias: the layer's depth taken from a point that much nearer the camera, so a layer that
  // slid into a crease of its own skin still shows; its place on screen is unchanged)
  float depthBias = uShellBias.x * max(0.0, L - uShellBias.y);
  if (depthBias > 0.0) {
    vec4 q = projectionMatrix * viewMatrix * vec4(wp + normalize(cameraPosition - wp) * depthBias, 1.0);
    gl_Position.z = q.z / q.w * gl_Position.w;
  }
#endif
  vec3 transformedNormal = (viewMatrix * vec4(sN, 0.0)).xyz;
#ifdef FUR_SHELL
  // (render hint shellShadowRoot: the cast shadow of a layer taken toward its strand's root, 4 mm off the skin)
  if (uShellShadowRoot > 0.0) worldPosition = vec4(mix(wp, sP + sN * 0.004, uShellShadowRoot), 1.0);
#endif
  #include <shadowmap_vertex>
  #include <fog_vertex>
}
`;

// Fins: the template quad (position.x in [-0.5, 0.5] across, position.y in [0, 1] up) is instanced
// once per skin vertex; all per-vertex data arrives as instanced attributes.
const finVertex = /* glsl */ `
#include <common>
#include <shadowmap_pars_vertex>
#include <fog_pars_vertex>
${common}
${DQS_GLSL}
attribute vec3 iPos;
attribute vec3 iNrm;
attribute vec3 iComb;
attribute vec4 iTint;
attribute vec4 iCoat;
attribute vec4 iPat;
attribute vec4 iSurf;
attribute vec4 iSkinIndex;
attribute vec4 iSkinWeight;
${hairProfile}

void main() {
  vec3 sP = iPos, sN = iNrm, sC = iComb;
  dqsSkinW(sP, sN, sC, iSkinIndex, iSkinWeight);
  sP = (modelMatrix * vec4(sP, 1.0)).xyz;
  sN = normalize(mat3(modelMatrix) * sN);
  sC = mat3(modelMatrix) * sC;
  sC = normalize(sC - sN * dot(sC, sN) + 1e-6);
  float L = iCoat.z * uFurScale;
  vec3 V = normalize(cameraPosition - sP);
  float ndv = dot(sN, V);
  // only near the silhouette; everything else is collapsed before rasterisation
  float vis = 1.0 - smoothstep(0.16, 0.42, abs(ndv));
  float m = matId(iTint.a);
  if (uFinMask > 0.5 && m < 0.5) vis *= clamp(1.0 - iSurf.y, 0.0, 1.0);
  // (no fins on the short sleek face fur: they would blur the tear lines and eye rims)
  if (vis < 0.01 || L < uFinMinLen || !hairy(m) || iCoat.w < 0.05) {
    gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
    vFin = vec4(0.0);
    return;
  }
  vec3 force = furForce(iPos, sN);
  float y = position.y;
  vec3 tipDir = hairDir(sN, sC, force, L, 1.0);
  vec3 side = cross(tipDir, V);
  side = dot(side, side) > 1e-8 ? normalize(side) : normalize(cross(sN, V) + 1e-4);
  float w = clamp(L * uFinWidth, 0.0028, 0.012) * (abs(m - 4.0) < 0.5 ? 0.45 : 1.0);
  // hairs on the silhouette stand a little prouder than the lying coat
  vec3 wp = sP + hairOffset(sN, sC, force, L * 1.08, y) + sN * (L * 0.08 * y) + side * (position.x * w);
  debugColour(iSkinIndex, iSkinWeight);
  vRest = iPos;
  vRestN = iNrm;
  vRestC = iComb;
  vWorldPos = wp;
  vN = sN;
  vT = hairDir(sN, sC, force, L, y);
  vTint = iTint;
#ifdef PA_MAT_BORDERS
  vMatW = matOneHot(iTint.a);
#endif
  vMatF = iTint.a;
  vCoat = iCoat;
  vPat = iPat;
  vSurf = iSurf;
  vFin = vec4(position.x + 0.5, y, vis, y);

  vec4 worldPosition = vec4(wp, 1.0);
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  // (the shells write depth, so a coat in front hides what lies behind it, fins included; a fin is
  // depth-tested from a point 0.6 hair lengths nearer the camera (the coat it stands in rises 0.5), so its
  // own coat does not hide it, while a part in front of it (a leg, a belly fringe) still does, and so does
  // the skin of a limb as thick as its hair: a tarantula's leg seen end-on hid the cards round its far side)
  vec4 qF = projectionMatrix * viewMatrix * vec4(wp + V * (L * 0.6), 1.0);
  gl_Position.z = qF.z / qF.w * gl_Position.w;
  vec3 transformedNormal = (viewMatrix * vec4(sN, 0.0)).xyz;
  #include <shadowmap_vertex>
  #include <fog_vertex>
}
`;

const fragment = /* glsl */ `
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <fog_pars_fragment>
${common}

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 hash33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
#ifdef FUR_SHELL
// strands and clumps of one planar projection (uv on the axis plane axisId): the coverage at shell height h
// (strand x clump footprint, before the coat's fade), and the strand / clump randoms for the shading
float strandLayer(vec2 uv, float axisId, float h, float furLen, float dens, float cDens, float clumpK, bool bristle,
                  out float sharp, out float sv, out vec4 ch, out float fromC, out float inClump) {
  vec2 cq = uv * cDens;
  vec2 cb = floor(cq) - 1.0;
  float bd2 = 1e9; vec2 cc = cq; vec2 cId = cb;
  if (clumpK > 0.001) for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {
    vec2 id = cb + vec2(float(i), float(j));
    vec2 c = id + 0.5 + (hash22(id + axisId * 57.3) - 0.5) * 0.9;
    vec2 dv = cq - c;
    float dd = dot(dv, dv);
    if (dd < bd2) { bd2 = dd; cc = c; cId = id; }
  }
  // short sleek fur (face, paws, lower legs) barely clumps; the body coat tufts properly
  ch = mix(vec4(0.5), vec4(hash22(cId + 11.3 + axisId * 57.3), hash22(cId + 23.9 + axisId * 57.3)), clumpK);
  float clumpLen = mix(0.6, 1.12, ch.x);
  // strands converge toward the clump centre as they rise: invert that to find the root seen here
  float pull = 0.7 * pow(h, 1.35) * clumpK;
  vec2 rootC = cc + (cq - cc) / max(0.25, 1.0 - pull);
  fromC = length(rootC - cc);
  vec2 q = rootC / cDens * dens;
  vec2 ci = floor(q);
  vec2 f = fract(q) - 0.5;
  vec2 cid = ci + axisId * 131.7;
  vec2 jit = (hash22(cid) - 0.5) * 0.5;
  sv = hash12(cid + 7.1);
  float sl = mix(0.55, 1.0, hash12(cid + 3.3)) * clumpLen;
  float hr = h / sl;
  float radius = 0.5 * (1.0 - 0.8 * min(hr * hr, 1.0)) * (bristle ? 0.3 : 1.0);
  float d = length(f - jit);
  float aa = fwidth(d) * 0.9 + 0.015;
  sharp = (hr > 1.0) ? 0.0 : smoothstep(radius + aa, radius - aa, d);
  // expected coverage when strands shrink below a pixel
  float pLong = clamp((clumpLen - h) / (0.5 * clumpLen), 0.0, 1.0);
  float expected = pLong * 3.14159 * 0.25 * (1.0 - 0.7 * h * h) * 0.9 * (bristle ? 0.06 : 1.0);
  float pix = length(fwidth(q));
  float cov = mix(sharp, expected, smoothstep(0.45, 1.4, pix));
  // outside the clump's shrinking footprint there is no hair at this height: gaps between tufts
  float ea = fwidth(fromC) * 0.8 + 0.03;
  inClump = mix(1.0, smoothstep(0.56 + ea, 0.56 - ea, fromC), clumpK);
  inClump = mix(inClump, 0.8, smoothstep(0.5, 1.5, fwidth(cq.x) + fwidth(cq.y)));
  return cov * inClump;
}
#endif
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// fades a procedural detail out once it gets smaller than a pixel (no shimmer at a distance)
float detailFade(float k) { return 1.0 - smoothstep(0.35, 0.9, length(fwidth(vRest)) * k); }
// noise stretched along a rest-space direction. The along-flow coordinate is measured from anchors
// snapped to 4 cm cells, so curving flow lines do not shear the pattern; two anchor lattices offset by
// half a cell are cross-faded so the cell borders do not show.
float edgeDist(vec3 f) { f = min(f, 1.0 - f); return min(min(f.x, f.y), f.z); }
float streak(vec3 P, vec3 Tr, float k, float s) {
  vec3 g = P * 25.0;
  float ea = edgeDist(fract(g)), eb = edgeDist(fract(g + 0.5));
  vec3 aA = floor(g) * 0.04, aB = (floor(g + 0.5) - 0.5) * 0.04;
  float st = k * (1.0 - 1.0 / s);
  float nA = vnoise(P * k - Tr * (dot(P - aA, Tr) * st));
  float nB = vnoise(P * k - Tr * (dot(P - aB, Tr) * st) + 17.3);
  float w = ea * ea / (ea * ea + eb * eb + 1e-6);
  return (mix(nB, nA, w) - 0.5) / sqrt(w * w + (1.0 - w) * (1.0 - w)) + 0.5;
}

// Overlapping shingles (scales, contour feathers): jittered cell centres in bind space, each one an
// ellipse attached at its front and free toward +comb; where several overlap, the most anterior one
// lies on top. Returns along (-1 front .. 1 free edge), across (-1..1), edge (ellipse radius 0..1),
// id, and shadow from the free edges of the scales in front.
struct Shingle { float along; float across; float edge; float id; float shadow; };
Shingle shingles(vec3 P, vec3 N, vec3 T, vec3 B, float s, float elong, float wid) {
  Shingle r; r.along = 0.0; r.across = 0.0; r.edge = 1.0; r.id = 0.0; r.shadow = 0.0;
  vec3 g = P / s; vec3 gi = floor(g);
  float ords[27]; float es[27];
  float bestOrd = 1e9;
  for (int k = 0; k < 27; k++) {
    vec3 id = gi + vec3(float(k % 3) - 1.0, float((k / 3) % 3) - 1.0, float(k / 9) - 1.0);
    vec3 c = id + 0.5 + (hash33(id) - 0.5) * 0.75;
    vec3 d = g - c;
    es[k] = 9.0; ords[k] = 1e9;
    if (abs(dot(d, N)) > 0.8) continue;
    float a = dot(d, T), b = dot(d, B);
    float al = (a - 0.35) / (0.85 * elong);
    float e = length(vec2(al, b / wid));
    float ord = dot(c, T) + (hash13(id + 3.1) - 0.5) * 0.4;
    es[k] = e; ords[k] = ord;
    if (e < 1.0 && ord < bestOrd) { bestOrd = ord; r.along = al; r.across = b / wid; r.edge = e; r.id = hash13(id + 7.7); }
  }
  for (int k = 0; k < 27; k++) if (ords[k] < bestOrd - 1e-4) r.shadow = max(r.shadow, smoothstep(1.45, 1.0, es[k]));
  if (bestOrd > 1e8) { r.edge = 1.0; r.shadow = 1.0; }
  return r;
}

// ---------------------------------------------------------------- light accumulation
vec3 gN, gNc, gT, gV, gAlb, gF0, gSSS, gAT, gDirect;
float gMemA = 1.0; // fin membrane opacity (material 11)
float gH, gOccl, gSv, gHair, gRough, gWrap, gCoat, gAniso, gEdge, gLit, gLitW, gTrans;
vec3 toWorld(vec3 dirView) { return normalize((vec4(dirView, 0.0) * viewMatrix).xyz); }
vec3 fresnel(vec3 f0, float c) { return f0 + (1.0 - f0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0); }

void shadeLight(vec3 L, vec3 C, float sh) {
  C *= RECIPROCAL_PI;
  float NdL = dot(gN, L);
  vec3 H = normalize(L + gV);
  float NdH = dot(gN, H);
  float wrap = clamp((NdL + 0.4) / 1.4, 0.0, 1.0);
  float w = lum(C);
  gLitW += w; gLit += w * wrap * sh;
  if (gHair > 0.5) {
    float TdL = dot(gT, L);
    float kk = sqrt(max(0.0, 1.0 - TdL * TdL));
    float diff = wrap * mix(1.0, 0.55 + 0.45 * kk, 0.6);
    // fur self shadowing: deep layers only lit when facing the light
    float selfSh = mix(smoothstep(-0.25, 0.55, NdL), 1.0, gH * 0.85 + 0.15);
    float shift = (gSv - 0.5) * 0.25;
    vec3 T1 = normalize(gT + gN * (-0.08 + shift));
    vec3 T2 = normalize(gT + gN * (0.14 + shift));
    float t1 = dot(T1, H), t2 = dot(T2, H);
    float s1 = pow(sqrt(max(0.0, 1.0 - t1 * t1)), 110.0);
    float s2 = pow(sqrt(max(0.0, 1.0 - t2 * t2)), 26.0);
    vec3 spec = (vec3(0.035) * s1 + gAlb * 0.4 * s2) * smoothstep(0.0, 0.6, NdH);
    spec *= smoothstep(-0.1, 0.35, NdL) * gOccl;
    // back-scatter through thin fur at silhouettes
    float backLit = pow(clamp(dot(-L, gV), 0.0, 1.0), 2.5);
    vec3 scatter = (gAlb + 0.04) * backLit * gEdge * 3.2 * (0.25 + 0.75 * gH);
    gDirect += (gAlb * diff * selfSh * gOccl + spec) * C * sh + scatter * C * mix(0.35, 1.0, sh);
  } else {
    float ndl = max(NdL, 0.0);
    // wrapped diffuse; the wrapped part is tinted like light scattered under the skin
    float dw = clamp((NdL + gWrap) / (1.0 + gWrap), 0.0, 1.0) / (1.0 + gWrap);
    vec3 diff = gAlb * (ndl + gSSS * max(dw - ndl, 0.0) * 2.0);
    // normalised Blinn-Phong
    float n = exp2(12.0 * (1.0 - gRough) + 1.0);
    float VdH = max(dot(gV, H), 0.0);
    vec3 F = fresnel(gF0, VdH);
    vec3 spec = F * ((n + 2.0) / 8.0) * pow(max(NdH, 0.0), n) * ndl;
    // anisotropic lobe along gAT (feather barbs, keratin striations, hair-like base fur)
    if (gAniso > 0.0) {
      float th = dot(gAT, H);
      float an = n * 0.5 + 8.0;
      spec += gAniso * F * ((an + 2.0) / 8.0) * pow(sqrt(max(0.0, 1.0 - th * th)), an) * smoothstep(-0.1, 0.3, NdL);
    }
    // clear coat (wet skin, polished keratin, fish scales)
    // (the coat lies over the bumps: it follows the smooth normal)
    if (gCoat > 0.0) { float cH = max(dot(gNc, H), 0.0); spec += gCoat * fresnel(vec3(0.04), VdH) * (802.0 / 8.0) * pow(cH, 800.0) * max(dot(gNc, L), 0.0); }
    // light through thin edges (ear tips, fins, horn tips)
    float backLit = pow(clamp(dot(-L, gV), 0.0, 1.0), 3.0) * gTrans;
    gDirect += (diff + spec) * C * sh + gAlb * gSSS * backLit * C * mix(0.3, 1.0, sh);
    // thin membranes (fins) glow through when lit from behind
    if (gTrans > 0.9) gDirect += gSSS * max(-NdL, 0.0) * C * mix(0.35, 1.0, sh) * 0.9;
  }
}

void main() {
  float h = vFin.w;
  float furLen = vCoat.z * uFurScale;
  // (render hint flatMaterial: the triangle's provoking-vertex material; otherwise matIdFrag, which with
  // matBorders splits the triangle through the edge middles; both off: the rounded interpolated id)
  float mat = uFlatMat > 0.5 ? matId(vMatF) : matIdFrag(vTint.a);
  vec4 surf = vSurf;

  // ---------- strand pattern (planar hashing, axis picked from rest normal)
  vec3 an = abs(vRestN);
  float axisId; vec2 uv;
  if (an.x > an.y && an.x > an.z) { uv = vRest.yz; axisId = 0.0; }
  else if (an.y > an.z) { uv = vRest.xz; axisId = 1.0; }
  else { uv = vRest.xy; axisId = 2.0; }
  float dens = uStrandDensity * mix(1.3, 1.0, smoothstep(0.004, 0.014, furLen));

  float alpha = 1.0;
  float sv = 0.5;          // per-strand random
  vec4 ch = vec4(0.5);     // per-clump randoms
  float fromC = 0.0;       // distance from the clump centre (0 .. ~0.7)
  float clumpK = 0.0;      // clumping strength
  float hazeF = 0.0, hazeNV = 1.0; // shells: the undercoat's share of this fragment's opacity, |N.V|
  bool bristle = abs(mat - 4.0) < 0.5, down = abs(mat - 9.0) < 0.5;
#ifdef FUR_SHELL
  if (furLen < 0.0006 || !hairy(mat)) discard;
  if (bristle) dens *= 0.2;
  if (down && h > 0.3) discard; // down: a short haze near the skin, not a pelt
  // ---- clumps: nearest strongly-jittered centre (3x3 cell search) -> organic, non-grid tufts
  float cDens = mix(300.0, 118.0, smoothstep(0.004, 0.03, furLen)) * uClumpDensity;
  clumpK = (bristle || down) ? 0.0 : smoothstep(uClumpLen.x, uClumpLen.y, furLen);
  float sharp, inClump;
  alpha = strandLayer(uv, axisId, h, furLen, dens, cDens, clumpK, bristle, sharp, sv, ch, fromC, inClump);
  if (uStrandBlend > 0.0) {
    // (opt-in, render hint strandBlend) the second-largest axis plane cross-faded in near a switch of the largest:
    // half and half where the two components are equal, none beyond uStrandBlend
    float a0 = axisId == 0.0 ? an.x : (axisId == 1.0 ? an.y : an.z);
    float ax2 = axisId == 0.0 ? (an.y > an.z ? 1.0 : 2.0) : (axisId == 1.0 ? (an.x > an.z ? 0.0 : 2.0) : (an.x > an.y ? 0.0 : 1.0));
    float b0 = ax2 == 0.0 ? an.x : (ax2 == 1.0 ? an.y : an.z);
    vec2 uv2 = ax2 == 0.0 ? vRest.yz : (ax2 == 1.0 ? vRest.xz : vRest.xy);
    float w2 = 0.5 * smoothstep(uStrandBlend, 0.0, a0 - b0);
    float sharp2, sv2, fromC2, inClump2; vec4 ch2;
    float alpha2 = strandLayer(uv2, ax2, h, furLen, dens, cDens, clumpK, bristle, sharp2, sv2, ch2, fromC2, inClump2);
    alpha = mix(alpha, alpha2, w2);
    sharp = mix(sharp, sharp2, w2); sv = mix(sv, sv2, w2); ch = mix(ch, ch2, w2); fromC = mix(fromC, fromC2, w2); inClump = mix(inClump, inClump2, w2);
  }
  // down: a soft haze of barbules rather than individual strands
  if (bristle && sv > 0.45) alpha = 0.0; // bristles are sparse
  if (down) alpha = (0.05 + 0.12 * sharp) * (1.0 - h / 0.3);
  // thin out the very outer shells
  alpha *= 1.0 - smoothstep(0.85, 1.0, h) * 0.5;
  // undercoat: the hair the strand grid does not resolve (a pelt has thousands of hairs per cm2, the grid
  // a few dozen strands). An optical depth per unit of coat height, dense at the roots and none at the
  // tips, taken through this layer's slab (1 / uShells of the coat) along the line of sight (Beer-Lambert:
  // the coat's opacity is the same at every shell count, and a coat seen along its lie, a fringe hanging
  // over a leg or down round a folded wing, is as dense as it is). Without it the gaps between strands
  // showed whatever lay under the outer layers: another part's lit skin, a wing, a leg's outline.
  if (!bristle && !down && uUnder > 0.0) {
    hazeNV = abs(dot(normalize(vN), normalize(cameraPosition - vWorldPos)));
    float tau = uUnder * (1.0 - smoothstep(0.3, 0.9, h)) * mix(1.0, inClump, 0.6 * clumpK);
    float fill = 1.0 - exp(-tau / (max(uShells, 1.0) * max(hazeNV, 0.2)));
    float aS = alpha;
    alpha = 1.0 - (1.0 - alpha) * (1.0 - fill);
    hazeF = alpha > 1e-4 ? (1.0 - aS) * fill / alpha : 0.0;
  }
  // cross-fade of two overlapping surfaces (vCoat.w): each takes its share of the coat's optical depth, so the
  // pair composites to one whole coat. Scaling the opacity instead left the middle of the band a quarter thinner
  // (two half-opaque layers cover 75 %): a pale or dark line where a head and a neck surface meet (a dog's ruff)
  alpha = vCoat.w > 1e-4 ? 1.0 - pow(max(1.0 - alpha, 1e-4), vCoat.w) : 0.0;
  alpha *= vFin.z;
  if (alpha < 0.02) discard;
#elif defined( FUR_FIN )
  // ---- a fin carries a handful of tapered strands side by side
  float nS = bristle ? 2.0 : 5.0;
  float u = vFin.x * nS;
  float y = vFin.y;
  float cov = 0.0;
  float i0 = floor(u);
  vec2 fid = vRest.xy * 1733.1 + vRest.z * 917.3;
  float uw = fwidth(u) * 0.8 + 0.02;
  for (int k = -1; k <= 1; k++) {
    float i = i0 + float(k);
    if (i < 0.0 || i >= nS) continue;
    vec2 hid = fid + vec2(i * 7.13, 0.0);
    float r1 = hash12(hid), r2 = hash12(hid + 3.7), r3 = hash12(hid + 9.1);
    float slen = mix(0.38, 1.1, r1 * r1 * (3.0 - 2.0 * r1));
    if (y > slen) continue;
    float cx = i + 0.5 + (r3 - 0.5) * 0.6 + (r2 - 0.5) * 1.4 * y * y;
    float wdt = 0.2 * (1.0 - y / slen) + 0.03;
    float c = smoothstep(wdt + uw, wdt - uw, abs(u - cx));
    if (c > cov) { cov = c; sv = r2; ch = vec4(r1, r3, r2, r1 * r3); }
  }
  alpha = cov * vFin.z * vCoat.w * (1.0 - 0.35 * smoothstep(0.6, 1.0, y)) * uFinFade;
  // the root half of a long hair's card lies inside its own coat, which the shells draw: drawn there too it
  // traced the base surface's outline, deep inside the coat, as a dark line (a long tail's core, a leg
  // under a fringe); the card shows the hair where it leaves the coat
  alpha *= mix(1.0, smoothstep(0.08, 0.5, y), smoothstep(0.008, 0.03, furLen));
  if (down) alpha *= 0.5;
  if (alpha < 0.02) discard;
#else
  // overlap band of two regions: each surface keeps its half, plus the sunk skirt past the midline
  if (vCoat.w < uSeam.y) discard;
#endif

  // ---------- frames: rest space (for procedural detail) and world space (for lighting)
  vec3 Nw = normalize(vN);
  vec3 Tw = dot(vT, vT) > 1e-12 ? normalize(vT) : Nw;
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 N = Nw;
  vec3 T = Tw;
  vec3 Nr = normalize(vRestN);
  vec3 Tr = vRestC - Nr * dot(vRestC, Nr);
  Tr = dot(Tr, Tr) > 1e-10 ? normalize(Tr) : normalize(cross(Nr, vec3(0.31, 0.83, 0.47)));
  vec3 Br = cross(Nr, Tr);
  vec3 Tb = normalize(Tw - Nw * dot(Tw, Nw) + 1e-6);
  vec3 Bw = cross(Nw, Tb);

  // ---------- albedo: base colour, pattern, marks
  vec3 base = vTint.rgb;
  bool furBase = false;
  // hair-level raggedness of pattern edges: whole tufts are in or out, single strands stray
  float jitS = (sv - 0.5) * 0.0036 + (ch.y - 0.5) * 0.0042;
#if !defined( FUR_SHELL ) && !defined( FUR_FIN )
  furBase = mat < 0.5;
  if (furBase) {
    // no strands here: jitter pattern edges with hair-flow streaks instead
    float st = streak(vRest, Tr, 900.0, 6.0) * 0.6 + streak(vRest + 7.1, Tr, 300.0, 4.0) * 0.4;
    jitS = (st - 0.5) * 0.014 * detailFade(300.0);
  } else jitS = 0.0;
#endif
  float pw = max(fwidth(vCoat.x), 0.0011);
  // (a negative pattern intensity is a flight-feather vane's bar count, see the vane branch below)
  float spot = smoothstep(pw, -pw, vCoat.x + jitS) * max(vPat.a, 0.0);
  // facial marks (tear lines, eye rims, lips, tail rings) are crisp lines: almost no strand jitter
  float mw = max(fwidth(vCoat.y), 0.0007);
  float mark = smoothstep(mw, -mw, vCoat.y + jitS * 0.08);
  vec3 alb = mix(base, vPat.rgb, spot);
  alb = mix(alb, uMarkColor, mark);

  // ---------- hair: strand / tuft shade variation, agouti banding, root darkening
#if defined( FUR_SHELL ) || defined( FUR_FIN )
  if (bristle) alb = mix(base * 1.1 + 0.03, alb, 0.3);
  if (down) alb = mix(alb, vec3(lum(alb)) * 1.2 + 0.02, 0.35);
  alb *= (0.8 + 0.4 * sv) * mix(0.86, 1.12, ch.z);
  // agouti: light roots, a dark band just below the tips (grizzle)
  float agouti = surf.z;
  if (agouti > 0.0) {
    float bc = 0.74 + (sv - 0.5) * 0.16;
    float band = smoothstep(0.14, 0.02, abs(h - bc)) * step(0.35, fract(sv * 7.3));
    alb = mix(alb, alb * 0.12 + vec3(0.006, 0.005, 0.004), band * agouti);
  }
  // undercoat: lighter, greyer roots
  alb = mix(alb, mix(alb, vec3(lum(alb)) * 1.35, 0.6), surf.w * (1.0 - smoothstep(0.1, 0.5, h)));
  // root darkening / tip lightening
  // (sparse bristles on bare skin: isolated hairs lit like the skin they grow from, no dark roots)
  alb *= bristle ? mix(0.9, 1.05, h) : mix(0.42, 1.08, pow(h, 0.55));
#endif

  // ---------- per material surface (base pass)
  float occl = 1.0;
  gHair = 1.0; gRough = 0.5; gWrap = 0.0; gCoat = 0.0; gAniso = 0.0; gTrans = 0.0;
  gF0 = vec3(0.04); gSSS = vec3(0.0); gAT = Tb;
  float aoAmb = 1.0;
  vec3 pert = vec3(0.0); // normal perturbation in (T, B, N) of the rest frame
#if !defined( FUR_SHELL ) && !defined( FUR_FIN )
  gHair = 0.0;
  float fd = 1.0;
  // crowd tier: no eye meshes, the eyes are painted into the base
  float painted = 0.0; vec3 eyeAlb = vec3(0.0);
  if (uPaintEyes > 0.5) {
    for (int i = 0; i < ${MAX_PAINTED_EYES}; i++) {
      if (uEyes[i].w <= 0.0) continue;
      float de = length(vRest - uEyes[i].xyz) / uEyes[i].w;
      if (de < 1.25) { painted = 1.0; eyeAlb = mix(uEyeTint[i], vec3(0.004), smoothstep(0.55, 0.3, de)); }
    }
    if (painted > 0.5) mat = 2.0;
  }
  if (mat < 0.5) {
    // fur seen from the base
    gHair = 1.0;
    if (uShellsOn > 0.5) {
      occl = 0.32; // deep in the coat, under the shells
    } else {
      // no shells: hair-flow streaks, per-lock shade and an anisotropic sheen make it read as fur
      alb *= uBaseTone;
      fd = detailFade(1200.0);
      float fd2 = detailFade(450.0), fd3 = detailFade(140.0);
      float s1 = streak(vRest, Tr, 1200.0, 8.0), s2 = streak(vRest + 3.7, Tr, 450.0, 5.0), s3 = streak(vRest + 9.2, Tr, 140.0, 3.0);
      sv = mix(0.5, s1, fd);
      // strands, locks and tufts: brighter crests, darker partings
      alb *= mix(1.0, 0.62 + 0.76 * s1, fd) * mix(1.0, 0.72 + 0.56 * s2, fd2) * mix(1.0, 0.8 + 0.4 * s3, fd3);
      alb *= mix(1.0, 1.0 - 0.6 * smoothstep(0.5, 0.75, s2), surf.z * fd2); // agouti speckle
      occl = 0.8;
      h = 0.6;
      ch = vec4(s3, s2, 0.5, s2);
      pert = vec3(0.0, ((s2 - 0.5) * 0.6 + (s3 - 0.5) * 0.5) * fd2, 0.0);
    }
  } else if (mat < 1.5) {
    // nose leather: pebbled cobbles with dark creases, satin sheen
    float k = 1.0 / 0.0007;
    fd = detailFade(k);
    vec3 g = vRest * k; vec3 gi = floor(g);
    float d1 = 9.0, d2 = 9.0; vec3 best = vec3(0.0);
    for (int kk = 0; kk < 27; kk++) {
      vec3 o = vec3(float(kk % 3) - 1.0, float((kk / 3) % 3) - 1.0, float(kk / 9) - 1.0);
      vec3 c = gi + o + hash33(gi + o);
      vec3 dv = g - c; dv -= Nr * dot(dv, Nr) * 0.7;
      float dd = length(dv);
      if (dd < d1) { d2 = d1; d1 = dd; best = dv; } else if (dd < d2) d2 = dd;
    }
    float crease = smoothstep(0.18, 0.0, d2 - d1) * fd;
    // (leatherTint: pink / brick leather in the tint colour, e.g. a cat's nose and pads; the tint keeps the
    // material ids next to fur 0 -> 1, where a pink bare-skin nose (4) interpolated through 1, 2, 3 at its rim)
    // (noseTint 1, the wolf's pale rims and painted septum, is the same blend at full strength: both take
    // the coat's per-vertex colour vTint, so the larger of the two wins)
    // (uLeatherRelief scales the pebbling: crease darkening, cobble shade and bump; 1 = the default)
    crease *= uLeatherRelief;
    alb = mix(vec3(0.05, 0.042, 0.04), vTint.rgb, max(uLeatherTint, uNoseTint)) * (1.0 + (0.4 * hash13(floor(g)) - 0.2) * uLeatherRelief) * (1.0 - 0.6 * crease);
    pert = vec3(dot(best, Tr), dot(best, Br), 0.0) * 0.5 * fd * uLeatherRelief;
    // (surf.y < 0: the roughness, -surf.y, of a drier, matte leather per vertex (bear); unset (>= 0) takes the
    // render hint noseRoughness, satin 0.42 by default)
    gRough = surf.y < 0.0 ? -surf.y : uNoseRough; gF0 = vec3(0.035); gWrap = 0.2; gSSS = vec3(0.3, 0.1, 0.08);
    aoAmb = 1.0 - 0.5 * crease;
    // (render hint noseMarks: marks on the leather are openings, the nostrils: dark, no sheen from inside)
    float nm = mark * uNoseMarks;
    alb = mix(alb, uMarkColor, nm); pert *= 1.0 - nm; gF0 *= 1.0 - nm; aoAmb *= 1.0 - 0.6 * nm;
  } else if (mat < 2.5) {
    // bare dark skin (lids, lips): smooth, slightly moist
    alb = vec3(0.012, 0.01, 0.01);
    gRough = 0.32; gWrap = 0.25; gSSS = vec3(0.5, 0.15, 0.1); gF0 = vec3(0.035);
    if (painted > 0.5) { alb = eyeAlb; gRough = 0.1; gCoat = 1.0; gWrap = 0.0; }
  } else if (mat < 3.5) {
    // mouth: wet, pink-red mucosa
    alb = vec3(0.25, 0.08, 0.08);
    gRough = 0.22; gWrap = 0.6; gSSS = vec3(0.9, 0.25, 0.2); gCoat = 0.5;
  } else if (mat < 4.5) {
    // bare skin: colour from rgb, soft subsurface wrap, fine pores and creases
    float k = 1.0 / 0.0009;
    fd = detailFade(k);
    float n1 = vnoise(vRest * k), n2 = vnoise(vRest * k * 0.23 + 5.1);
    float pore = smoothstep(0.72, 0.9, n1) * fd;
    alb *= (1.0 - 0.25 * pore) * (0.92 + 0.16 * n2);
    pert = vec3((n1 - 0.5) * 0.12, (vnoise(vRest * k + 9.3) - 0.5) * 0.12, 0.0) * fd;
    gRough = mix(0.62, 0.3, surf.x); gWrap = uSkinScatter.w; gSSS = uSkinScatter.rgb; gTrans = uSkinTrans.x + (uSkinTrans.y > 0.0 ? uSkinTrans.y * surf.y : 0.0);
    aoAmb = 1.0 - 0.3 * pore;
  } else if (mat < 5.5) {
    // keratin (hoof, horn, beak, claw): glossy, growth striations running along the comb
    float k = 1.0 / 0.0006;
    fd = detailFade(k);
    float fd2 = detailFade(k * 0.2);
    float s1 = streak(vRest, Tr, k, 14.0), s2 = streak(vRest + 1.3, Tr, k * 0.2, 10.0);
    float rings = 0.5 + 0.5 * sin(dot(vRest, Tr) * 700.0 + s2 * 4.0);
    alb *= mix(1.0, 0.8 + 0.4 * s1, fd) * mix(1.0, (0.7 + 0.6 * s2) * (0.92 + 0.08 * rings), fd2);
    pert = vec3(0.0, (s1 - 0.5) * 0.35 * fd + (s2 - 0.5) * 0.5 * fd2, 0.0);
    // (surf.x < 0, opt-in: duller than gloss 0, -1 matte: the highlight and the grazing sheen are the same on any
    // albedo, and on dark horn they read as chrome; 0 keeps the default 0.6)
    float gl = surf.x > 0.0 ? surf.x : (surf.x < 0.0 ? 0.0 : 0.6);
    float matte = clamp(-surf.x, 0.0, 1.0);
    gRough = mix(mix(0.55, 0.12, gl), 0.85, matte); gCoat = 0.25 * gl; gAniso = 0.6 * (1.0 - matte); gAT = Tb; gWrap = 0.15;
    gSSS = alb * 0.8 + 0.02; gTrans = 0.35;
  } else if (mat < 6.5) {
    // scales laid out along the comb: overlapping, domed, dark edges, optional keel and iridescence
    float sz = surf.y > 0.0 ? surf.y : 0.004;
    fd = detailFade(1.0 / sz * 1.5);
    if (surf.z < -0.5) {
      // ventral scutes (snakes): plates spanning the belly, one per surf.y along the comb, each one's
      // free (posterior) edge lying over the next: a bright lip, a dark gap, then its shadow
      float a = dot(vRest, Tr) / sz, f = fract(a);
      float gap = smoothstep(0.035, 0.0, f) + smoothstep(0.965, 1.0, f);
      float lip = smoothstep(0.78, 0.94, f) * (1.0 - smoothstep(0.94, 0.97, f));
      float sh = smoothstep(0.3, 0.035, f);
      alb *= mix(1.0, (0.92 + 0.12 * hash13(vec3(floor(a), 1.7, 3.1))) * (1.0 - 0.55 * gap) * (1.0 + 0.12 * lip) * (1.0 - 0.28 * sh), fd);
      pert = vec3(-0.3 - 0.35 * (f - 0.5), 0.0, 0.0) * fd;
      float gl = surf.x > 0.0 ? surf.x : 0.6;
      gRough = mix(0.6, 0.16, gl); gCoat = 0.4 * gl; gWrap = 0.12;
      aoAmb = 1.0 - 0.4 * max(gap, sh) * fd;
    } else if (uDenticle > 0.0) {
      // shark skin (render hint denticles): tiny keeled denticles in rows along the comb. Single
      // denticles, rows of them and broader streaks fade out in turn with distance; the ridges tilt the
      // normal across the comb, so the light breaks into a fine grain along the body. Matte: a soft,
      // broad sheen stretched across the ridges (anisotropic lobe), no clear coat.
      float kd = 1.0 / sz;
      float fd2 = detailFade(kd * 0.25), fd3 = detailFade(kd * 0.06);
      float g1 = streak(vRest, Tr, kd, 6.0), g2 = streak(vRest + 3.1, Tr, kd * 0.25, 5.0), g3 = streak(vRest + 8.7, Tr, kd * 0.06, 4.0);
      float grain = mix(1.0, 0.8 + 0.4 * g1, fd) * mix(1.0, 0.86 + 0.28 * g2, fd2) * mix(1.0, 0.93 + 0.14 * g3, fd3);
      alb *= mix(1.0, grain, uDenticle);
      pert = vec3(0.0, (g1 - 0.5) * 0.5 * fd + (g2 - 0.5) * 0.35 * fd2 + (g3 - 0.5) * 0.18 * fd3, 0.0) * uDenticle;
      float gl = surf.x > 0.0 ? surf.x : 0.2;
      gRough = mix(0.78, 0.38, gl); gCoat = 0.0; gWrap = 0.3; gSSS = alb * 0.6;
      gAniso = 0.55 * uDenticle; gAT = Tb;
      aoAmb = 1.0 - 0.18 * (1.0 - g2) * fd2 * uDenticle;
    } else {
    // surf.w < 0: lower relief and edge contrast (smooth plates, clean satin scales), -1 = flat
    float scC = surf.w < 0.0 ? clamp(1.0 + surf.w, 0.0, 1.0) : 1.0;
    Shingle S = shingles(vRest, Nr, Tr, Br, sz * 0.62, 1.25, 0.7);
    // free edge: a thin bright lip, then the dark gap under it; base of the scale in shadow
    float rim = smoothstep(0.8, 0.98, S.edge);
    float lip = smoothstep(0.62, 0.8, S.edge) * (1.0 - rim) * step(0.0, S.along);
    float keel = surf.z * exp(-S.across * S.across / 0.02);
    alb *= mix(1.0, (0.82 + 0.3 * S.id) * (1.0 - 0.6 * rim) * (1.0 + 0.25 * lip) * (1.0 - 0.7 * S.shadow) * mix(0.72, 1.0, smoothstep(-0.8, 0.4, S.along)) * (1.0 + 0.35 * keel), fd * uScaleEdge * scC);
    // the scale rises toward its free edge and is domed across; the keel is a ridge down the middle
    pert = vec3(-0.35 - 0.3 * S.along, -S.across * 0.45 - sign(S.across) * keel * 0.6, 0.0) * fd * scC * (0.35 + 0.65 * uScaleEdge);
    float gl = surf.x > 0.0 ? surf.x : 0.45;
    gRough = mix(0.6, 0.18, gl); gCoat = 0.35 * gl; gWrap = 0.1;
    aoAmb = 1.0 - 0.5 * S.shadow * fd * scC * uScaleEdge;
    if (surf.w > 0.0) {
      float nv = clamp(dot(Nw, V), 0.0, 1.0);
      vec3 film = 0.5 + 0.5 * cos(6.2831 * (nv * 1.6 + S.id * 0.25 + vec3(0.0, 0.33, 0.67)));
      gF0 = mix(vec3(0.04), film * 0.35, surf.w);
      alb = mix(alb, alb * 0.8 + film * lum(alb) * 0.25, surf.w * 0.4);
    }
    }
  } else if (mat < 7.5) {
    // wet skin (frog): granular bumps, glossy clear coat, strong subsurface
    float sz = surf.y > 0.0 ? surf.y : 0.0015;
    float k = 1.0 / sz;
    fd = detailFade(k);
    float b1 = vnoise(vRest * k), b2 = vnoise(vRest * k * 2.7 + 3.3);
    float bump = smoothstep(0.45, 0.85, b1) * 0.7 + b2 * 0.3;
    float e = 0.12;
    float bx = vnoise((vRest + Tr * sz * e) * k), by = vnoise((vRest + Br * sz * e) * k);
    pert = vec3(-(bx - b1), -(by - b1), 0.0) / e * 0.18 * fd;
    alb *= mix(1.0, 0.85 + 0.3 * bump, fd);
    float gl = surf.x > 0.0 ? surf.x : 0.85;
    gRough = mix(0.5, 0.2, gl); gCoat = gl; gWrap = 0.6; gSSS = vec3(0.6, 0.75, 0.4) * 0.8; gTrans = 0.6;
  } else if (mat < 8.5) {
    // chitin: hard, glossy, dark, fine segment sutures and micro-pitting. A negative feature scale
    // (surf.y < 0) means smooth cuticle without sutures (spiders), |surf.y| = pitting scale
    float sz = surf.y > 0.0 ? surf.y : 0.003;
    float pitK = surf.y < 0.0 ? 1.0 / max(-surf.y, 1e-5) : 2500.0;
    fd = detailFade(surf.y < 0.0 ? pitK : 1.0 / 0.0004);
    float seg = fract(dot(vRest, Tr) / sz + streak(vRest, Tr, 90.0, 3.0) * 0.3);
    float suture = surf.y < 0.0 ? 0.0 : smoothstep(0.1, 0.0, seg) + smoothstep(0.93, 1.0, seg);
    float pit = vnoise(vRest * pitK);
    alb *= (1.0 - 0.7 * suture) * mix(1.0, 0.85 + 0.3 * pit, fd);
    pert = vec3((seg - 0.5) * 0.5 + (pit - 0.5) * 0.15 * fd, 0.0, 0.0);
    float gl = surf.x > 0.0 ? surf.x : 0.75;
    gRough = mix(0.5, 0.15, gl); gCoat = 0.4 * gl; gWrap = 0.05;
    gF0 = mix(vec3(0.045), vec3(0.08, 0.06, 0.03) + alb, surf.w);
    aoAmb = 1.0 - 0.5 * suture;
  } else if (mat > 10.5) {
    // fin membrane (11): thin translucent skin stretched between bony rays. surf.y = ray phase (rays
    // at integer values), surf.z = position along the ray (0 base .. 1 margin), surf.w = opacity.
    // Rays are jointed and fork toward the margin; the membrane between them is clearer.
    float along = clamp(surf.z, 0.0, 1.2);
    float fork = smoothstep(0.5, 0.62, along);
    float pr = surf.y * (1.0 + fork);
    float dRay = abs(fract(pr + 0.5) - 0.5);
    float fwR = fwidth(pr) * 0.8 + 1e-4;
    float rw = mix(0.16, 0.1, along) * mix(1.0, 0.7, fork);
    float rayFade = 1.0 - smoothstep(0.35, 0.7, fwR);
    float ray = smoothstep(rw + fwR, rw - fwR, dRay) * rayFade;
    float seg = abs(fract(along * 16.0 + surf.y * 0.37) - 0.5);
    float joint = smoothstep(0.06, 0.0, abs(seg - 0.47)) * ray * detailFade(1.0 / 0.0015);
    alb = mix(alb, alb * 0.72 + vec3(0.004), ray * 0.8);
    alb = mix(alb, alb * 1.25 + 0.02, joint * 0.5);
    gMemA = clamp(mix(surf.w, min(1.0, surf.w + 0.38), ray) * (1.0 - 0.3 * smoothstep(0.85, 1.05, along)), 0.0, 1.0);
    pert = vec3(0.0, sign(fract(pr + 0.5) - 0.5) * ray * 0.22 * rayFade, 0.0);
    float gl = surf.x > 0.0 ? surf.x : 0.7;
    gRough = mix(0.55, 0.22, gl); gCoat = 0.3 * gl; gWrap = 0.45; gSSS = alb * 0.8 + 0.01; gTrans = 1.0;
  } else if (mat < 9.5) {
    // feathers: contour-feather shingles with a rachis, barbs and a barb-anisotropic sheen
    float sz = surf.y > 0.0 ? surf.y : 0.012;
    fd = detailFade(1.0 / sz * 2.0);
    Shingle S = shingles(vRest, Nr, Tr, Br, sz * 0.55, 1.35, 0.8);
    float rachis = smoothstep(0.06, 0.0, abs(S.across)) * smoothstep(1.0, 0.2, S.along);
    float barbPh = (abs(S.across) * 0.9 - S.along * 0.55) * 22.0;
    float fdB = detailFade(1.0 / sz * 30.0);
    float barbs = (0.5 + 0.5 * sin(barbPh * 6.2831)) * fdB;
    float tipFray = smoothstep(0.85, 1.0, S.edge) * smoothstep(0.0, 0.6, S.along);
    if (surf.z < 0.0) {
      // per-feather markings (poultry and game birds): surf.z = -(mode + amount), marking colour in
      // the pattern colour (its intensity unused): 0 lacing (a band along the free edge), 1 bars across
      // the feather, 2 a shaft streak down the middle, 3 spangle (a dark bar and a light tip). Far away
      // the marking blends to its mean coverage instead of vanishing.
      float mm = -surf.z, mode = floor(mm + 1e-3), amt = clamp(mm - mode, 0.0, 1.0);
      float mk = 0.0, mMean = 0.3;
      if (mode < 0.5) mk = smoothstep(0.6, 0.78, S.edge) * smoothstep(-0.4, 0.0, S.along);
      else if (mode < 1.5) { mk = smoothstep(-0.3, 0.3, sin((S.along * 2.3 + S.id * 0.35) * 6.2831)); mMean = 0.5; }
      else if (mode < 2.5) { mk = smoothstep(0.4, 0.16, abs(S.across)) * smoothstep(-0.7, 0.1, S.along); mMean = 0.18; }
      else {
        float tip = smoothstep(0.52, 0.68, S.along) * smoothstep(0.98, 0.85, S.edge);
        float bar = smoothstep(0.15, 0.3, S.along) * (1.0 - smoothstep(0.5, 0.6, S.along));
        alb = mix(alb, alb * 0.1, mix(0.15, bar, fd) * amt);
        mk = tip; mMean = 0.15;
      }
      alb = mix(alb, vPat.rgb, mix(mMean, mk, fd) * amt);
    }
    alb *= mix(1.0, (0.85 + 0.25 * S.id) * (1.0 - 0.35 * S.shadow) * (0.9 + 0.2 * barbs) * (1.0 - 0.3 * tipFray), fd * uFeatherEdge);
    alb = mix(alb, alb * 1.25 + 0.03, rachis * 0.6 * fd);
    pert = vec3(-0.25 - 0.25 * S.along, -S.across * 0.3, 0.0) * fd;
    vec3 barbDir = normalize(Tr * 0.55 + Br * sign(S.across) * 0.84);
    gAT = normalize(Tb * dot(barbDir, Tr) + Bw * dot(barbDir, Br));
    gAniso = 0.5 * fd; gRough = mix(0.8, 0.45, surf.x); gWrap = 0.3; gSSS = alb * 0.5; gTrans = 0.3;
    aoAmb = 1.0 - 0.45 * S.shadow * fd;
    if (surf.w > 0.0) {
      // structural colour (crow / starling gloss): a thin-film tint of the specular lobe
      float nv = clamp(dot(Nw, V), 0.0, 1.0);
      vec3 film = mix(vec3(0.42, 0.3, 1.0), vec3(0.12, 0.62, 0.72), pow(1.0 - nv, 1.4) + (S.id - 0.5) * 0.25);
      gF0 = mix(vec3(0.04), film * 0.14, surf.w);
    }
  } else {
    // flight-feather vane (feather cards, core/build/featherCards.js): surf = [gloss, iridescence,
    // across (-1 outer edge .. 0 rachis .. 1 inner edge), along (0 root .. 1 tip)], vCoat.x = signed
    // metres from the rachis. Rachis, barbs leaving it toward the tip, barb splits, worn edges, a
    // barb-anisotropic sheen, structural colour and light through the thin vane.
    float across = surf.z, along = surf.w, ac = abs(across);
    float xm = abs(vCoat.x), ym = dot(vRest, Tr), sgn = vCoat.x < 0.0 ? -1.0 : 1.0;
    float aw = fwidth(across) + 1e-4;
    float rw = mix(0.07, 0.018, along);
    float rach = smoothstep(rw + aw, rw - aw, ac) * (1.0 - smoothstep(0.8, 1.0, along));
    float bc = (ym - xm * 1.5) / 0.00032;
    float fdB = detailFade(1.0 / 0.00032);
    float barb = (0.5 + 0.5 * sin(bc * 6.2831)) * fdB;
    float grp = floor((ym - xm * 1.5) / 0.0045);
    float split = step(0.88, hash12(vec2(grp, sgn * 7.0))) * smoothstep(0.35, 0.85, ac) * detailFade(220.0);
    float edge = smoothstep(0.8, 1.0, ac);
    fd = detailFade(220.0);
    if (vPat.a < 0.0) {
      // barred vanes (opt-in, featherCards colour().bar): -vPat.a bars from root to tip in vPat.rgb, bent
      // into shallow chevrons toward the edges; far away they blend to their mean
      float ph = along * -vPat.a + ac * 0.22;
      float fdBar = 1.0 - smoothstep(0.25, 0.5, fwidth(ph));
      float bar = smoothstep(-0.25, 0.25, sin(ph * 6.2831));
      alb = mix(alb, vPat.rgb, mix(0.5, bar, fdBar));
    }
    alb *= (0.9 + 0.2 * barb) * (1.0 - 0.4 * split * fd) * (1.0 - 0.22 * edge) * (0.94 + 0.12 * along);
    alb = mix(alb, alb * 1.35 + 0.012, rach * 0.55);
    pert = vec3((barb - 0.5) * 0.1, sgn * 0.2 * smoothstep(0.08, 1.0, ac) - sgn * 0.25 * split * fd, 0.0);
    vec3 barbDir = normalize(Tr * 0.83 + Br * sgn * 0.56);
    gAT = normalize(Tb * dot(barbDir, Tr) + Bw * dot(barbDir, Br));
    // light through the vane and the barb sheen scale with the pigment: melanin-dark feathers stay
    // dark from below and against the light, pale feathers glow
    float vLum = max(alb.r, max(alb.g, alb.b)), vTk = smoothstep(0.02, 0.3, vLum);
    gAniso = 0.45 * mix(0.12, 1.0, vTk); gRough = mix(0.8, 0.45, surf.x); gWrap = 0.2 * vTk; gSSS = alb * 0.6 + 0.004 * vTk; gTrans = 0.6 * vTk;
    if (surf.y > 0.0) {
      float nv = clamp(dot(Nw, V), 0.0, 1.0);
      vec3 film = mix(vec3(0.42, 0.3, 1.0), vec3(0.12, 0.62, 0.72), clamp(pow(1.0 - nv, 1.4) + along * 0.15, 0.0, 1.0));
      gF0 = mix(vec3(0.04), film * 0.09, surf.y);
    }
    aoAmb = 1.0 - 0.25 * edge - 0.2 * split * fd;
  }
  if (gHair < 0.5) N = normalize(Nw + Tb * pert.x + Bw * pert.y);
  else if (uShellsOn < 0.5) N = normalize(Nw + Bw * pert.y);
#endif

  // ---------- hair lighting frame
  if (gHair > 0.5) {
    // each tuft leans a little its own way: breaks the smooth shading into fur texture
    vec3 Bt = normalize(cross(N, T) + 1e-6);
    N = normalize(N + (T * (ch.w - 0.5) + Bt * (ch.z - 0.5)) * 0.55 * h);
#if defined( FUR_SHELL ) || defined( FUR_FIN )
    occl = bristle ? mix(0.85, 1.0, h) : mix(0.3, 1.0, pow(h, 0.7));
    // the valleys between tufts are darker than the tufts themselves
    occl *= mix(1.0, 0.7, smoothstep(0.22, 0.56, fromC) * (1.0 - h) * clumpK);
#endif
  }
  gN = N; gNc = normalize(mix(Nw, N, 0.25)); gT = T; gV = V; gAlb = alb; gH = h; gOccl = occl; gSv = sv;
  gEdge = pow(1.0 - abs(dot(Nw, V)), 1.6);
#ifdef FUR_FIN
  gEdge = 1.0;
#endif
  gDirect = vec3(0.0); gLit = 0.0; gLitW = 0.0;

  // ---------- scene lights (three.js uniforms are in view space)
  IncidentLight directLight;
  float shD, shS, shP, shT; // (declared outside the unrolled loops)
  vec3 geoPos = (viewMatrix * vec4(vWorldPos, 1.0)).xyz;
#if NUM_DIR_LIGHTS > 0
  DirectionalLight directionalLight;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
  DirectionalLightShadow directionalLightShadow;
  #endif
  #pragma unroll_loop_start
  for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
    directionalLight = directionalLights[ i ];
    getDirectionalLightInfo( directionalLight, directLight );
    shD = 1.0;
    #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
    directionalLightShadow = directionalLightShadows[ i ];
    shD = receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
    #endif
    shadeLight( toWorld( directLight.direction ), directLight.color, shD );
  }
  #pragma unroll_loop_end
#endif
#if NUM_SUN_LIGHTS > 0
  SunLight sunLight;
  #if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
  SunLightShadow sunLightShadow;
  #endif
  #pragma unroll_loop_start
  for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
    sunLight = sunLights[ i ];
    getSunLightInfo( sunLight, directLight );
    shS = 1.0;
    #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
    sunLightShadow = sunLightShadows[ i ];
    shS = receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
    #endif
    shadeLight( toWorld( directLight.direction ), directLight.color, shS );
  }
  #pragma unroll_loop_end
#endif
#if NUM_POINT_LIGHTS > 0
  PointLight pointLight;
  #if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
  PointLightShadow pointLightShadow;
  #endif
  #pragma unroll_loop_start
  for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
    pointLight = pointLights[ i ];
    getPointLightInfo( pointLight, geoPos, directLight );
    shP = 1.0;
    #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
    pointLightShadow = pointLightShadows[ i ];
    shP = ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
    #endif
    if ( directLight.visible ) shadeLight( toWorld( directLight.direction ), directLight.color, shP );
  }
  #pragma unroll_loop_end
#endif
#if NUM_SPOT_LIGHTS > 0
  SpotLight spotLight;
  #if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
  SpotLightShadow spotLightShadow;
  #endif
  #pragma unroll_loop_start
  for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
    spotLight = spotLights[ i ];
    getSpotLightInfo( spotLight, geoPos, directLight );
    shT = 1.0;
    #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
    spotLightShadow = spotLightShadows[ i ];
    shT = ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
    #endif
    if ( directLight.visible ) shadeLight( toWorld( directLight.direction ), directLight.color, shT );
  }
  #pragma unroll_loop_end
#endif

  // ---------- ambient: hemisphere + ambient lights (+ light probes)
  vec3 irr = ambientLightColor;
  vec3 fillIrr = ambientLightColor * 2.0;
  vec3 R = reflect(-V, N);
  vec3 envIrr = ambientLightColor;
#if NUM_HEMI_LIGHTS > 0
  for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
    vec3 hd = toWorld( hemisphereLights[ i ].direction );
    irr += mix( hemisphereLights[ i ].groundColor, hemisphereLights[ i ].skyColor, 0.5 * dot( N, hd ) + 0.5 );
    envIrr += mix( hemisphereLights[ i ].groundColor, hemisphereLights[ i ].skyColor, smoothstep( -0.3, 0.3, dot( R, hd ) ) );
    fillIrr += hemisphereLights[ i ].skyColor + hemisphereLights[ i ].groundColor;
  }
#endif
  // the scene environment's diffuse light (sky and ground of an image-based environment, which three.js
  // feeds only to its own standard materials): irradiance at the normal, the reflection's blurred
  // radiance, and the fill's sky + ground like the hemisphere lights' (setEnvironmentLight)
  if (uEnvOn > 0.0) {
    irr += shGetIrradianceAt( N, uEnvSH );
    envIrr += shGetIrradianceAt( R, uEnvSH );
    fillIrr += shGetIrradianceAt( vec3(0.0, 1.0, 0.0), uEnvSH ) + shGetIrradianceAt( vec3(0.0, -1.0, 0.0), uEnvSH );
  }
#if defined( USE_LIGHT_PROBES )
  vec3 pN = ( viewMatrix * vec4( N, 0.0 ) ).xyz;
  irr += getLightProbeIrradiance( lightProbe, pN );
  envIrr += getLightProbeIrradiance( lightProbe, ( viewMatrix * vec4( R, 0.0 ) ).xyz );
#endif
  irr *= RECIPROCAL_PI; fillIrr *= RECIPROCAL_PI; envIrr *= RECIPROCAL_PI;
  // soft camera-side fill (the "bounce card" of wildlife cinematography): lifts the side turned away
  // from the key light so it reads as warm tan instead of mud, without flattening the lit side
  float litFrac = gLitW > 0.0 ? gLit / gLitW : 0.0;
  vec3 fill = fillIrr * uFill * clamp(dot(N, V) * 0.6 + 0.4, 0.0, 1.0) * (1.0 - litFrac);
  vec3 col;
  if (gHair > 0.5) {
    col = alb * irr * pow(occl, 0.75) + alb * fill + gDirect;
  } else {
    float nv = max(dot(N, V), 0.0);
    float gloss = (1.0 - gRough) * (1.0 - gRough);
    vec3 envSpec = envIrr * (fresnel(gF0, nv) * gloss + gCoat * fresnel(vec3(0.04), max(dot(gNc, V), 0.0)));
    col = (alb * irr + alb * fill) * aoAmb + gDirect + envSpec * aoAmb;
  }

#ifdef PA_DEBUG
#if !defined(FUR_SHELL) && !defined(FUR_FIN) && !defined(FIN_MEMBRANE)
  // 'holes': the inside of the skin seen through a gap (not the seam skirt, sunk under the other surface on purpose)
  if (uDebug > 3.5 && !gl_FrontFacing && vCoat.w >= 0.5) col = vec3(1.0, 0.0, 0.0);
#endif
  if (uDebug > 0.5 && uDebug < 1.5) col = alb;
  if (uDebug > 1.5 && uDebug < 2.5) col = vDbg * 0.8;
  if (uDebug > 2.5 && uDebug < 3.5) {
    float m = mat;
    col = m < 0.5 ? vec3(0.8, 0.55, 0.25) : m < 1.5 ? vec3(0.9, 0.1, 0.5) : m < 2.5 ? vec3(0.15, 0.15, 0.15) : m < 3.5 ? vec3(1.0, 0.2, 0.2)
        : m < 4.5 ? vec3(1.0, 0.7, 0.6) : m < 5.5 ? vec3(0.9, 0.9, 0.3) : m < 6.5 ? vec3(0.2, 0.8, 0.3) : m < 7.5 ? vec3(0.2, 0.6, 1.0)
        : m < 8.5 ? vec3(0.5, 0.2, 0.9) : m < 9.5 ? vec3(0.3, 0.9, 0.9) : m < 10.5 ? vec3(0.1, 0.4, 0.9) : vec3(0.95, 0.55, 0.9);
    col *= 0.6;
  }
#endif
#ifdef FUR_SHELL
  // the undercoat stands for what the line of sight met between the strands before it existed: looking
  // into the coat, the deep coat (the base's dark fur, occlusion 0.32); along it, more hair at this
  // height. So the coat keeps its tone and its dark partings, and only what lay beneath is covered.
  if (hazeF > 0.0) {
    float shellShade = mix(0.42, 1.08, pow(h, 0.55)) * occl;
    float kH = mix(1.0, clamp(0.32 / max(shellShade, 1e-3), 0.3, 1.0), smoothstep(0.2, 0.7, hazeNV));
    col *= mix(1.0, kH, hazeF);
  }
#endif
  col = max(col, vec3(0.0));
#ifdef FIN_MEMBRANE
  alpha = gMemA;
#endif
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

// shadow casters: the same dual-quaternion deformation as the visible surface
function dqsPatch(material, uniforms, key) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uDQ = uniforms.uDQ;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + DQS_GLSL + DQS_ATTR_GLSL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  { vec3 dn = vec3(0.0, 1.0, 0.0), dt = vec3(1.0, 0.0, 0.0); dqsSkin(transformed, dn, dt); }');
  };
  material.customProgramCacheKey = () => key;
  return material;
}

export function createShadowMaterials(uniforms) {
  return {
    depth: dqsPatch(new THREE.MeshDepthMaterial(), uniforms, 'pa-dqs-depth'),
    distance: dqsPatch(new THREE.MeshDistanceMaterial(), uniforms, 'pa-dqs-distance'),
  };
}

export function createCoatMaterials(uniforms) {
  const make = (params) => {
    const u = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog]);
    // this animal's own uniform objects, shared by its three passes
    Object.assign(u, uniforms);
    return new THREE.ShaderMaterial({ uniforms: u, lights: true, fog: true, ...params });
  };
  // (render hint matBorders: material borders through the edge middles, see matIdFrag; off by default)
  const mb = uniforms.uMatBorders && uniforms.uMatBorders.value > 0 ? { PA_MAT_BORDERS: 1 } : {};
  const base = make({ vertexShader: vertex, fragmentShader: fragment, defines: { ...mb } });
  const shells = make({ vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: true, defines: { FUR_SHELL: 1, ...mb } });
  const fins = make({ vertexShader: finVertex, fragmentShader: fragment, transparent: true, depthWrite: false, side: THREE.DoubleSide, defines: { FUR_FIN: 1, ...mb } });
  // translucent fin membranes (material 11), drawn from their own index subset (membranes.js)
  const membrane = make({ vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, defines: { FIN_MEMBRANE: 1, ...mb } });
  return { base, shells, fins, membrane };
}

// debug colours compile only on demand
export function setMaterialsDebug(mats, on) {
  for (const m of Object.values(mats)) {
    const has = !!m.defines.PA_DEBUG;
    if (has === on) continue;
    if (on) m.defines.PA_DEBUG = 1;
    else delete m.defines.PA_DEBUG;
    m.needsUpdate = true;
  }
}

export function makeCoatUniforms(hints = {}) {
  const r = { ...RENDER_DEFAULTS, ...hints };
  return {
    uShells: { value: 28 },
    uShellsOn: { value: 1 },
    uUnder: { value: r.undercoat },
    uFinFade: { value: 1 },
    uFurScale: { value: r.shellScale },
    uFurForce: { value: new THREE.Vector3(0, -0.15, 0) },
    uFurRaise: { value: 0 },
    uRaiseLen: { value: new THREE.Vector2(...r.raiseLen) },
    uClumpLen: { value: new THREE.Vector2(...r.clumpLen) },
    uTime: { value: 0 },
    uStrandDensity: { value: r.strandDensity },
    uClumpDensity: { value: r.clumpDensity },
    uFinWidth: { value: r.finWidth },
    uFinMask: { value: r.finMask ? 1 : 0 },
    uFinMinLen: { value: r.finMinLen },
    uStrandBlend: { value: r.strandBlend || 0 },
    uMarkColor: { value: new THREE.Color(...r.markColor) },
    uNoseRough: { value: r.noseRoughness },
    uNoseMarks: { value: r.noseMarks ? 1 : 0 },
    uNoseTint: { value: r.noseTint ? 1 : 0 },
    uFill: { value: 0.45 },
    uScaleEdge: { value: r.scaleEdge },
    uFeatherEdge: { value: r.featherEdge },
    uLeatherTint: { value: +r.leatherTint || 0 },
    uLeatherRelief: { value: r.leatherRelief ?? 1 },
    uSkinScatter: { value: new THREE.Vector4(...r.skinScatter) },
    uSkinTrans: { value: new THREE.Vector2(...r.skinTrans) },
    uDenticle: { value: r.denticles },
    uEnvSH: { value: Array.from({ length: 9 }, () => new THREE.Vector3()) },
    uEnvOn: { value: 0 },
    uWind: { value: 0.1 },
    uDebug: { value: 0 },
    uForceMat: { value: -1 },
    uFlatMat: { value: r.flatMaterial ? 1 : 0 },
    uPaintEyes: { value: 0 },
    uBaseTone: { value: new THREE.Vector3(1, 1, 1) },
    uShellShadowRoot: { value: r.shellShadowRoot },
    uShellBias: { value: new THREE.Vector2(...r.shellDepthBias) },
    // no skirt (older bakes without data.seamSink): each surface stops at its midline
    uSeam: { value: new THREE.Vector2(0, 0.5) },
    // (not read by the shaders: createCoatMaterials compiles the matBorders variant when it is set)
    uMatBorders: { value: r.matBorders ? 1 : 0 },
    uEyes: { value: Array.from({ length: MAX_PAINTED_EYES }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uEyeTint: { value: Array.from({ length: MAX_PAINTED_EYES }, () => new THREE.Color(0.1, 0.05, 0.01)) },
    uDQ: { value: null },
  };
}
